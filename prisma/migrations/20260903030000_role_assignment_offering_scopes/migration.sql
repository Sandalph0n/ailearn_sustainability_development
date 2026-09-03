-- Một RoleAssignment OFFERING có thể áp dụng cho nhiều Offering. Các scope cũ được giữ lại,
-- còn nhiều assignment active của cùng user/role được hợp nhất thành một assignment active.

BEGIN;

CREATE TABLE "RoleAsgmtScopeToOffering" (
    "roleAssignmentId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,

    CONSTRAINT "RoleAsgmtScopeToOffering_pkey"
        PRIMARY KEY ("roleAssignmentId", "offeringId")
);

CREATE INDEX "RoleAsgmtScopeToOffering_offeringId_idx"
ON "RoleAsgmtScopeToOffering"("offeringId");

ALTER TABLE "RoleAsgmtScopeToOffering"
ADD CONSTRAINT "RoleAsgmtScopeToOffering_roleAssignmentId_fkey"
FOREIGN KEY ("roleAssignmentId") REFERENCES "RoleAssignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoleAsgmtScopeToOffering"
ADD CONSTRAINT "RoleAsgmtScopeToOffering_offeringId_fkey"
FOREIGN KEY ("offeringId") REFERENCES "Offering"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chuyển quan hệ một-nhiều cũ sang bảng nối trước khi bỏ cột.
INSERT INTO "RoleAsgmtScopeToOffering" ("roleAssignmentId", "offeringId")
SELECT id, "offeringId"
FROM "RoleAssignment"
WHERE "offeringId" IS NOT NULL;

-- Mô hình cũ có thể có nhiều assignment active cho cùng user/role, mỗi dòng một offering.
-- Chọn dòng được cấp sớm nhất làm assignment active chuẩn và gom mọi scope active vào đó.
WITH ranked AS (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY "userId", "roleId"
            ORDER BY "roleGrantedAt", id
        ) AS canonical_id
    FROM "RoleAssignment"
    WHERE "roleRevokedAt" IS NULL
)
INSERT INTO "RoleAsgmtScopeToOffering" ("roleAssignmentId", "offeringId")
SELECT DISTINCT ranked.canonical_id, scope."offeringId"
FROM ranked
JOIN "RoleAsgmtScopeToOffering" scope
  ON scope."roleAssignmentId" = ranked.id
ON CONFLICT DO NOTHING;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "roleId"
            ORDER BY "roleGrantedAt", id
        ) AS row_number
    FROM "RoleAssignment"
    WHERE "roleRevokedAt" IS NULL
)
UPDATE "RoleAssignment" assignment
SET "roleRevokedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE assignment.id = ranked.id
  AND ranked.row_number > 1;

DROP TRIGGER "RoleAssignment_scope_matches_role" ON "RoleAssignment";
DROP FUNCTION "check_role_assignment_scope"();

ALTER TABLE "RoleAssignment"
DROP CONSTRAINT "RoleAssignment_offeringId_fkey";

DROP INDEX "RoleAssignment_offeringId_idx";
DROP INDEX "RoleAssignment_one_active_unscoped_role";
DROP INDEX "RoleAssignment_one_active_offering_role";

ALTER TABLE "RoleAssignment"
DROP COLUMN "offeringId";

CREATE UNIQUE INDEX "RoleAssignment_one_active_user_role"
ON "RoleAssignment"("userId", "roleId")
WHERE "roleRevokedAt" IS NULL;

-- Scope chỉ hợp lệ với role OFFERING và phải trỏ tới offering cùng institution.
CREATE FUNCTION "check_role_assignment_offering_scope"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    assignment_scope "RoleScopeType";
    assignment_institution UUID;
    assignment_revoked_at TIMESTAMP(3);
    offering_institution UUID;
BEGIN
    SELECT role."scopeType", role."institutionId", assignment."roleRevokedAt"
    INTO assignment_scope, assignment_institution, assignment_revoked_at
    FROM "RoleAssignment" assignment
    JOIN "Role" role ON role.id = assignment."roleId"
    WHERE assignment.id = NEW."roleAssignmentId";

    SELECT subject."institutionId" INTO offering_institution
    FROM "Offering" offering
    JOIN "Subject" subject ON subject.id = offering."subjectId"
    WHERE offering.id = NEW."offeringId";

    IF assignment_scope IS DISTINCT FROM 'OFFERING' THEN
        RAISE EXCEPTION 'Only offering roles can be scoped to offerings'
            USING ERRCODE = '23514';
    END IF;

    IF assignment_revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'A revoked role assignment cannot receive a new offering scope'
            USING ERRCODE = '23514';
    END IF;

    IF assignment_institution IS DISTINCT FROM offering_institution THEN
        RAISE EXCEPTION 'Role assignment and offering must belong to the same institution'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "RoleAsgmtScopeToOffering_validate_trigger"
BEFORE INSERT OR UPDATE OF "roleAssignmentId", "offeringId"
ON "RoleAsgmtScopeToOffering"
FOR EACH ROW EXECUTE FUNCTION "check_role_assignment_offering_scope"();

-- Không cho đổi role của assignment theo cách làm các scope hiện có mất hợp lệ.
CREATE FUNCTION "check_role_assignment_role_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_role_scope "RoleScopeType";
    new_role_institution UUID;
BEGIN
    IF OLD."roleId" IS NOT DISTINCT FROM NEW."roleId" THEN
        RETURN NEW;
    END IF;

    SELECT "scopeType", "institutionId"
    INTO new_role_scope, new_role_institution
    FROM "Role"
    WHERE id = NEW."roleId";

    IF EXISTS (
        SELECT 1
        FROM "RoleAsgmtScopeToOffering" scope
        JOIN "Offering" offering ON offering.id = scope."offeringId"
        JOIN "Subject" subject ON subject.id = offering."subjectId"
        WHERE scope."roleAssignmentId" = OLD.id
          AND (
              new_role_scope IS DISTINCT FROM 'OFFERING'
              OR subject."institutionId" IS DISTINCT FROM new_role_institution
          )
    ) THEN
        RAISE EXCEPTION 'The new role is incompatible with existing offering scopes'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "RoleAssignment_validate_role_change_trigger"
BEFORE UPDATE OF "roleId" ON "RoleAssignment"
FOR EACH ROW EXECUTE FUNCTION "check_role_assignment_role_change"();

-- Đổi subject/term của offering vẫn phải bị chặn nếu đã có lịch sử scope.
CREATE OR REPLACE FUNCTION "preventLinkedOfferingMove"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW."subjectId", NEW."termId") IS DISTINCT FROM (OLD."subjectId", OLD."termId")
       AND (
           EXISTS (SELECT 1 FROM "Assessment" WHERE "offeringId" = OLD.id)
           OR EXISTS (
               SELECT 1
               FROM "RoleAsgmtScopeToOffering"
               WHERE "offeringId" = OLD.id
           )
       )
    THEN
        RAISE EXCEPTION 'An offering with assessments or assignment history cannot move';
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;

BEGIN;

-- Một quyền có thể được cấp lại sau khi thu hồi; mỗi chu kỳ phải còn nguyên để audit.
ALTER TABLE "RolePermission"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_pkey";
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id");

CREATE INDEX "RolePermission_roleId_permissionId_idx"
ON "RolePermission"("roleId", "permissionId");

CREATE UNIQUE INDEX "RolePermission_one_active_grant"
ON "RolePermission"("roleId", "permissionId")
WHERE "revokedAt" IS NULL;

-- Không cho hai assignment còn hiệu lực cho cùng người, vai trò và phạm vi.
CREATE UNIQUE INDEX "RoleAssignment_one_active_institution_role"
ON "RoleAssignment"("userId", "roleId")
WHERE "roleRevokedAt" IS NULL AND "offeringId" IS NULL;

CREATE UNIQUE INDEX "RoleAssignment_one_active_offering_role"
ON "RoleAssignment"("userId", "roleId", "offeringId")
WHERE "roleRevokedAt" IS NULL AND "offeringId" IS NOT NULL;

-- Subject và Term của một Offering luôn phải thuộc cùng cơ sở.
CREATE FUNCTION "check_offering_institution"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    subject_institution UUID;
    term_institution UUID;
BEGIN
    SELECT "institutionId" INTO subject_institution
    FROM "Subject" WHERE "id" = NEW."subjectId";

    SELECT "institutionId" INTO term_institution
    FROM "StudyTerm" WHERE "id" = NEW."termId";

    IF subject_institution IS DISTINCT FROM term_institution THEN
        RAISE EXCEPTION 'Offering subject and term must belong to the same institution'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Offering_same_institution"
BEFORE INSERT OR UPDATE OF "subjectId", "termId" ON "Offering"
FOR EACH ROW EXECUTE FUNCTION "check_offering_institution"();

CREATE FUNCTION "prevent_linked_academic_move"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."institutionId" IS DISTINCT FROM NEW."institutionId" THEN
        IF TG_TABLE_NAME = 'Subject' AND EXISTS (
            SELECT 1 FROM "Offering" WHERE "subjectId" = OLD."id"
        ) THEN
            RAISE EXCEPTION 'A subject with offerings cannot move institution'
                USING ERRCODE = '23514';
        END IF;

        IF TG_TABLE_NAME = 'StudyTerm' AND EXISTS (
            SELECT 1 FROM "Offering" WHERE "termId" = OLD."id"
        ) THEN
            RAISE EXCEPTION 'A term with offerings cannot move institution'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Subject_keep_linked_institution"
BEFORE UPDATE OF "institutionId" ON "Subject"
FOR EACH ROW EXECUTE FUNCTION "prevent_linked_academic_move"();

CREATE TRIGGER "StudyTerm_keep_linked_institution"
BEFORE UPDATE OF "institutionId" ON "StudyTerm"
FOR EACH ROW EXECUTE FUNCTION "prevent_linked_academic_move"();

-- Scope của assignment suy ra từ Role; offering (nếu có) phải ở cùng cơ sở.
CREATE FUNCTION "check_role_assignment_scope"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    role_scope "RoleScopeType";
    role_institution UUID;
    offering_institution UUID;
BEGIN
    SELECT "scopeType", "institutionId" INTO role_scope, role_institution
    FROM "Role" WHERE "id" = NEW."roleId";

    IF role_scope = 'INSTITUTION' AND NEW."offeringId" IS NOT NULL THEN
        RAISE EXCEPTION 'Institution role assignment cannot target an offering'
            USING ERRCODE = '23514';
    END IF;

    IF role_scope = 'OFFERING' AND NEW."offeringId" IS NULL THEN
        RAISE EXCEPTION 'Offering role assignment requires an offering'
            USING ERRCODE = '23514';
    END IF;

    IF NEW."offeringId" IS NOT NULL THEN
        SELECT subject."institutionId" INTO offering_institution
        FROM "Offering" offering
        JOIN "Subject" subject ON subject."id" = offering."subjectId"
        WHERE offering."id" = NEW."offeringId";

        IF role_institution IS DISTINCT FROM offering_institution THEN
            RAISE EXCEPTION 'Role and offering must belong to the same institution'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "RoleAssignment_scope_matches_role"
BEFORE INSERT OR UPDATE OF "roleId", "offeringId" ON "RoleAssignment"
FOR EACH ROW EXECUTE FUNCTION "check_role_assignment_scope"();

CREATE FUNCTION "prevent_role_scope_history_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."scopeType" IS DISTINCT FROM NEW."scopeType"
       AND (
           EXISTS (SELECT 1 FROM "RoleAssignment" WHERE "roleId" = OLD."id")
           OR EXISTS (SELECT 1 FROM "RoleRequest" WHERE "roleId" = OLD."id")
       ) THEN
        RAISE EXCEPTION 'A role with assignment or request history cannot change scope'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Role_keep_scope_with_history"
BEFORE UPDATE OF "scopeType" ON "Role"
FOR EACH ROW EXECUTE FUNCTION "prevent_role_scope_history_change"();

-- RoleRequest hiện không mang offeringId, nên chỉ xin được role cấp Institution.
CREATE FUNCTION "check_role_request_scope"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    role_scope "RoleScopeType";
    role_institution UUID;
BEGIN
    SELECT "scopeType", "institutionId" INTO role_scope, role_institution
    FROM "Role" WHERE "id" = NEW."roleId";

    IF role_scope <> 'INSTITUTION' OR role_institution IS DISTINCT FROM NEW."institutionId" THEN
        RAISE EXCEPTION 'Join requests require an institution role from the same institution'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "RoleRequest_institution_role_only"
BEFORE INSERT OR UPDATE OF "roleId", "institutionId" ON "RoleRequest"
FOR EACH ROW EXECUTE FUNCTION "check_role_request_scope"();

COMMIT;

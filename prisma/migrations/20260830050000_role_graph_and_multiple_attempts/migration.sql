BEGIN;

-- Role kế thừa theo đồ thị nhiều-nhiều thay vì mỗi vai trò chỉ có một cha.
CREATE TABLE "RoleInclusion" (
    "includingRoleId" UUID NOT NULL,
    "includedRoleId" UUID NOT NULL,

    CONSTRAINT "RoleInclusion_pkey" PRIMARY KEY ("includingRoleId", "includedRoleId")
);

-- Bảo toàn mọi cạnh của mô hình một-cha cũ trước khi bỏ cột.
INSERT INTO "RoleInclusion" ("includingRoleId", "includedRoleId")
SELECT "includedById", "id"
FROM "Role"
WHERE "includedById" IS NOT NULL;

CREATE INDEX "RoleInclusion_includedRoleId_idx" ON "RoleInclusion"("includedRoleId");

ALTER TABLE "RoleInclusion"
ADD CONSTRAINT "RoleInclusion_includingRoleId_fkey"
FOREIGN KEY ("includingRoleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoleInclusion"
ADD CONSTRAINT "RoleInclusion_includedRoleId_fkey"
FOREIGN KEY ("includedRoleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dữ liệu cũ phải cùng cơ sở trước khi chuyển sang luật mới.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "RoleInclusion" edge
        JOIN "Role" parent ON parent."id" = edge."includingRoleId"
        JOIN "Role" child ON child."id" = edge."includedRoleId"
        WHERE parent."institutionId" <> child."institutionId"
    ) THEN
        RAISE EXCEPTION 'Existing role hierarchy crosses institution boundaries';
    END IF;
END;
$$;

ALTER TABLE "Role" DROP CONSTRAINT "Role_includedById_fkey";
ALTER TABLE "Role" DROP COLUMN "includedById";

-- Serialize hierarchy changes, then reject cross-institution edges and cycles.
-- Advisory lock closes the race where A->B and B->A are inserted concurrently.
CREATE FUNCTION "check_role_inclusion"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    including_institution UUID;
    included_institution UUID;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('ailearn.role-inclusion'));

    SELECT "institutionId" INTO including_institution
    FROM "Role"
    WHERE "id" = NEW."includingRoleId";

    SELECT "institutionId" INTO included_institution
    FROM "Role"
    WHERE "id" = NEW."includedRoleId";

    IF including_institution IS DISTINCT FROM included_institution THEN
        RAISE EXCEPTION 'Included roles must belong to the same institution'
            USING ERRCODE = '23514';
    END IF;

    IF NEW."includingRoleId" = NEW."includedRoleId" THEN
        RAISE EXCEPTION 'A role cannot include itself'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        WITH RECURSIVE descendants("roleId") AS (
            SELECT edge."includedRoleId"
            FROM "RoleInclusion" edge
            WHERE edge."includingRoleId" = NEW."includedRoleId"

            UNION

            SELECT edge."includedRoleId"
            FROM "RoleInclusion" edge
            JOIN descendants current ON current."roleId" = edge."includingRoleId"
        )
        SELECT 1
        FROM descendants
        WHERE "roleId" = NEW."includingRoleId"
    ) THEN
        RAISE EXCEPTION 'Role inclusion would create a cycle'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "RoleInclusion_acyclic_same_institution"
BEFORE INSERT OR UPDATE ON "RoleInclusion"
FOR EACH ROW
EXECUTE FUNCTION "check_role_inclusion"();

-- Mỗi AssessmentAttempt có khoá riêng để một người làm cùng bài nhiều lần.
ALTER TABLE "AssessmentAttempt"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "AssignmentWorkspace"
ADD COLUMN "attemptId" UUID;

UPDATE "AssignmentWorkspace" workspace
SET "attemptId" = attempt."id"
FROM "AssessmentAttempt" attempt
WHERE workspace."attemptUserId" = attempt."userId"
  AND workspace."attemptAssessmentId" = attempt."assessmentId";

ALTER TABLE "AssignmentWorkspace"
ALTER COLUMN "attemptId" SET NOT NULL;

ALTER TABLE "AssignmentWorkspace"
DROP CONSTRAINT "AssignmentWorkspace_attemptUserId_attemptAssessmentId_fkey";

DROP INDEX "AssignmentWorkspace_attemptUserId_attemptAssessmentId_key";

ALTER TABLE "AssignmentWorkspace"
DROP COLUMN "attemptUserId",
DROP COLUMN "attemptAssessmentId";

ALTER TABLE "AssessmentAttempt"
DROP CONSTRAINT "AssessmentAttempt_pkey";

ALTER TABLE "AssessmentAttempt"
ADD CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id");

CREATE INDEX "AssessmentAttempt_userId_assessmentId_idx"
ON "AssessmentAttempt"("userId", "assessmentId");

CREATE UNIQUE INDEX "AssignmentWorkspace_attemptId_key"
ON "AssignmentWorkspace"("attemptId");

ALTER TABLE "AssignmentWorkspace"
ADD CONSTRAINT "AssignmentWorkspace_attemptId_fkey"
FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

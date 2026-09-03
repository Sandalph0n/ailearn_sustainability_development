-- Replace two provenance booleans with one mutually exclusive source enum.

BEGIN;

CREATE TYPE "ScopeAssignmentSource" AS ENUM ('DIRECT', 'CODE', 'REQUEST_APPROVED');

ALTER TABLE "ScopeAssignment"
ADD COLUMN "source" "ScopeAssignmentSource";

-- The old trigger deliberately makes provenance immutable. Disable it while translating the
-- existing representation, then replace it below with its enum-aware version.
DROP TRIGGER "ScopeAssignment_validate_trigger" ON "ScopeAssignment";

ALTER TABLE "ScopeAssignment"
DROP CONSTRAINT "ScopeAssignment_source_check";

-- An approved request is the strongest provenance signal. These rows used to be represented as
-- direct grants by the reviewer, so classify them before handling ordinary direct grants.
UPDATE "ScopeAssignment" scope
SET "source" = 'REQUEST_APPROVED',
    "assignedDirectlyById" = NULL,
    "usedCodeId" = NULL
WHERE EXISTS (
    SELECT 1
    FROM "ScopeAssignmentRequest" request
    WHERE request."approvedScopeAssignmentId" = scope.id
      AND request."status" = 'APPROVED'
);

UPDATE "ScopeAssignment"
SET "source" = 'CODE',
    "assignedDirectlyById" = NULL
WHERE "source" IS NULL
  AND ("isAssignedUsingCode" = true OR "usedCodeId" IS NOT NULL);

UPDATE "ScopeAssignment"
SET "source" = 'DIRECT',
    "usedCodeId" = NULL
WHERE "source" IS NULL
  AND ("isAssignedDirectlyByUser" = true OR "assignedDirectlyById" IS NOT NULL);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "ScopeAssignment" WHERE "source" IS NULL) THEN
        RAISE EXCEPTION 'ScopeAssignment contains a row whose provenance cannot be classified';
    END IF;
END;
$$;

ALTER TABLE "ScopeAssignment"
DROP COLUMN "isAssignedDirectlyByUser",
DROP COLUMN "isAssignedUsingCode",
ALTER COLUMN "source" SET NOT NULL,
ADD CONSTRAINT "ScopeAssignment_source_check" CHECK (
    (
        "source" = 'DIRECT'
        AND "assignedDirectlyById" IS NOT NULL
        AND "usedCodeId" IS NULL
    )
    OR
    (
        "source" = 'CODE'
        AND "assignedDirectlyById" IS NULL
        AND "usedCodeId" IS NOT NULL
    )
    OR
    (
        "source" = 'REQUEST_APPROVED'
        AND "assignedDirectlyById" IS NULL
        AND "usedCodeId" IS NULL
    )
);

-- Validate role scope, institution, provenance and code/offering compatibility together.
CREATE OR REPLACE FUNCTION "check_scope_assignment"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    assignment_scope "RoleScopeType";
    assignment_institution UUID;
    assignment_revoked_at TIMESTAMP(3);
    offering_institution UUID;
    code_offering_id UUID;
    code_used_at TIMESTAMP(3);
BEGIN
    IF TG_OP = 'UPDATE' AND (
        OLD."roleAssignmentId",
        OLD."offeringId",
        OLD."source",
        OLD."assignedDirectlyById",
        OLD."usedCodeId"
    ) IS DISTINCT FROM (
        NEW."roleAssignmentId",
        NEW."offeringId",
        NEW."source",
        NEW."assignedDirectlyById",
        NEW."usedCodeId"
    ) THEN
        RAISE EXCEPTION 'A scope assignment source and target are immutable'
            USING ERRCODE = '23514';
    END IF;

    SELECT role."scopeType", role."institutionId", assignment."roleRevokedAt"
    INTO assignment_scope, assignment_institution, assignment_revoked_at
    FROM "RoleAssignment" assignment
    JOIN "Role" role ON role.id = assignment."roleId"
    WHERE assignment.id = NEW."roleAssignmentId";

    SELECT subject."institutionId"
    INTO offering_institution
    FROM "Offering" offering
    JOIN "Subject" subject ON subject.id = offering."subjectId"
    WHERE offering.id = NEW."offeringId";

    IF assignment_scope IS DISTINCT FROM 'OFFERING' THEN
        RAISE EXCEPTION 'Only offering roles can receive offering scopes'
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

    IF NEW."source" = 'CODE' THEN
        SELECT code."offeringId", code."usedAt"
        INTO code_offering_id, code_used_at
        FROM "ScopeAssignmentCode" code
        WHERE code.id = NEW."usedCodeId"
        FOR UPDATE;

        IF code_offering_id IS DISTINCT FROM NEW."offeringId" THEN
            RAISE EXCEPTION 'Scope assignment code belongs to a different offering'
                USING ERRCODE = '23514';
        END IF;

        IF code_used_at IS NOT NULL THEN
            RAISE EXCEPTION 'Scope assignment code has already been used'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ScopeAssignment_validate_trigger"
BEFORE INSERT OR UPDATE
ON "ScopeAssignment"
FOR EACH ROW EXECUTE FUNCTION "check_scope_assignment"();

-- The request points to the generated scope, so the pair is assembled in two statements inside
-- one transaction. Deferred constraint triggers validate the completed pair at commit time.
CREATE FUNCTION "check_scope_assignment_request_provenance"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."source" = 'REQUEST_APPROVED' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM "ScopeAssignmentRequest" request
            WHERE request."approvedScopeAssignmentId" = NEW.id
              AND request."status" = 'APPROVED'
              AND request."roleAssignmentId" = NEW."roleAssignmentId"
              AND request."offeringId" = NEW."offeringId"
        ) THEN
            RAISE EXCEPTION 'REQUEST_APPROVED scope must come from its matching approved request'
                USING ERRCODE = '23514';
        END IF;
    ELSIF EXISTS (
        SELECT 1
        FROM "ScopeAssignmentRequest" request
        WHERE request."approvedScopeAssignmentId" = NEW.id
    ) THEN
        RAISE EXCEPTION 'A scope linked from an approved request must use REQUEST_APPROVED source'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "ScopeAssignment_request_provenance_trigger"
AFTER INSERT OR UPDATE ON "ScopeAssignment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_scope_assignment_request_provenance"();

CREATE FUNCTION "check_scope_assignment_request_result"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."status" = 'PENDING' THEN
        IF NEW."processedAt" IS NOT NULL
           OR NEW."processedByUserId" IS NOT NULL
           OR NEW."approvedScopeAssignmentId" IS NOT NULL THEN
            RAISE EXCEPTION 'A pending scope request cannot have a processing result'
                USING ERRCODE = '23514';
        END IF;
    ELSIF NEW."status" = 'REJECTED' THEN
        IF NEW."processedAt" IS NULL
           OR NEW."processedByUserId" IS NULL
           OR NEW."approvedScopeAssignmentId" IS NOT NULL THEN
            RAISE EXCEPTION 'A rejected scope request needs a processor and no approved scope'
                USING ERRCODE = '23514';
        END IF;
    ELSIF NEW."status" = 'APPROVED' THEN
        IF NEW."processedAt" IS NULL
           OR NEW."processedByUserId" IS NULL
           OR NEW."approvedScopeAssignmentId" IS NULL
           OR NOT EXISTS (
               SELECT 1
               FROM "ScopeAssignment" scope
               WHERE scope.id = NEW."approvedScopeAssignmentId"
                 AND scope."source" = 'REQUEST_APPROVED'
                 AND scope."roleAssignmentId" = NEW."roleAssignmentId"
                 AND scope."offeringId" = NEW."offeringId"
           ) THEN
            RAISE EXCEPTION 'An approved scope request needs its matching REQUEST_APPROVED scope'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "ScopeAssignmentRequest_result_trigger"
AFTER INSERT OR UPDATE ON "ScopeAssignmentRequest"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_scope_assignment_request_result"();

COMMIT;

-- Replace the bare RoleAssignment/Offering join with an auditable scope grant.
-- Existing scope rows are preserved and attributed to the role grantor or request reviewer.

BEGIN;

DROP TRIGGER IF EXISTS "RoleAsgmtScopeToOffering_validate_trigger"
ON "RoleAsgmtScopeToOffering";
DROP FUNCTION IF EXISTS "check_role_assignment_offering_scope"();

DROP TRIGGER IF EXISTS "RoleAssignment_validate_role_change_trigger"
ON "RoleAssignment";
DROP FUNCTION IF EXISTS "check_role_assignment_role_change"();

ALTER TABLE "RoleAsgmtScopeToOffering"
RENAME TO "ScopeAssignment";

ALTER TABLE "ScopeAssignment"
DROP CONSTRAINT "RoleAsgmtScopeToOffering_pkey",
DROP CONSTRAINT "RoleAsgmtScopeToOffering_roleAssignmentId_fkey",
DROP CONSTRAINT "RoleAsgmtScopeToOffering_offeringId_fkey";

DROP INDEX "RoleAsgmtScopeToOffering_offeringId_idx";

ALTER TABLE "ScopeAssignment"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN "isAssignedDirectlyByUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isAssignedUsingCode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "assignedDirectlyById" UUID,
ADD COLUMN "usedCodeId" UUID;

-- Every legacy scope came from the old direct/admin flow. Prefer the explicit role grantor;
-- assignments created by an approved request use the reviewer as the auditable source.
UPDATE "ScopeAssignment" scope
SET "assignedDirectlyById" = COALESCE(assignment."grantDirectlyById", request."processedByUserId"),
    "isAssignedDirectlyByUser" = true
FROM "RoleAssignment" assignment
LEFT JOIN "RoleRequest" request
  ON request."approvedAssignmentId" = assignment.id
WHERE assignment.id = scope."roleAssignmentId"
  AND COALESCE(assignment."grantDirectlyById", request."processedByUserId") IS NOT NULL;

-- Refuse to invent an actor for historical data. The operator must repair any unauditable row
-- before applying this migration rather than silently attributing it to the assignee.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "ScopeAssignment"
        WHERE "assignedDirectlyById" IS NULL
    ) THEN
        RAISE EXCEPTION 'Legacy offering scope has no grantor or request reviewer';
    END IF;
END;
$$;

CREATE TABLE "ScopeAssignmentCode" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "offeringId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ScopeAssignmentCode_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScopeAssignment"
ADD CONSTRAINT "ScopeAssignment_pkey" PRIMARY KEY ("id"),
ADD CONSTRAINT "ScopeAssignment_source_check" CHECK (
    (
        "isAssignedDirectlyByUser" = true
        AND "isAssignedUsingCode" = false
        AND "assignedDirectlyById" IS NOT NULL
        AND "usedCodeId" IS NULL
    )
    OR
    (
        "isAssignedDirectlyByUser" = false
        AND "isAssignedUsingCode" = true
        AND "assignedDirectlyById" IS NULL
        AND "usedCodeId" IS NOT NULL
    )
);

CREATE UNIQUE INDEX "ScopeAssignment_roleAssignmentId_offeringId_key"
ON "ScopeAssignment"("roleAssignmentId", "offeringId");

CREATE UNIQUE INDEX "ScopeAssignment_usedCodeId_key"
ON "ScopeAssignment"("usedCodeId");

CREATE INDEX "ScopeAssignment_roleAssignmentId_idx"
ON "ScopeAssignment"("roleAssignmentId");

CREATE INDEX "ScopeAssignment_offeringId_idx"
ON "ScopeAssignment"("offeringId");

CREATE INDEX "ScopeAssignment_assignedDirectlyById_idx"
ON "ScopeAssignment"("assignedDirectlyById");

CREATE INDEX "ScopeAssignmentCode_offeringId_idx"
ON "ScopeAssignmentCode"("offeringId");

CREATE INDEX "ScopeAssignmentCode_createdById_idx"
ON "ScopeAssignmentCode"("createdById");

ALTER TABLE "ScopeAssignment"
ADD CONSTRAINT "ScopeAssignment_roleAssignmentId_fkey"
FOREIGN KEY ("roleAssignmentId") REFERENCES "RoleAssignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ScopeAssignment_offeringId_fkey"
FOREIGN KEY ("offeringId") REFERENCES "Offering"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ScopeAssignment_assignedDirectlyById_fkey"
FOREIGN KEY ("assignedDirectlyById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ScopeAssignment_usedCodeId_fkey"
FOREIGN KEY ("usedCodeId") REFERENCES "ScopeAssignmentCode"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScopeAssignmentCode"
ADD CONSTRAINT "ScopeAssignmentCode_offeringId_fkey"
FOREIGN KEY ("offeringId") REFERENCES "Offering"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ScopeAssignmentCode_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Validate role scope, institution, provenance and code/offering compatibility together.
CREATE FUNCTION "check_scope_assignment"()
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
        OLD."isAssignedDirectlyByUser",
        OLD."isAssignedUsingCode",
        OLD."assignedDirectlyById",
        OLD."usedCodeId"
    ) IS DISTINCT FROM (
        NEW."roleAssignmentId",
        NEW."offeringId",
        NEW."isAssignedDirectlyByUser",
        NEW."isAssignedUsingCode",
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

    IF NEW."usedCodeId" IS NOT NULL THEN
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

CREATE FUNCTION "mark_scope_assignment_code_used"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."usedCodeId" IS NOT NULL THEN
        UPDATE "ScopeAssignmentCode"
        SET "usedAt" = CURRENT_TIMESTAMP
        WHERE id = NEW."usedCodeId";
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ScopeAssignment_mark_code_used_trigger"
AFTER INSERT
ON "ScopeAssignment"
FOR EACH ROW EXECUTE FUNCTION "mark_scope_assignment_code_used"();

-- Once a code has been used, its offering and creator remain part of the audit trail.
CREATE FUNCTION "prevent_scope_assignment_code_identity_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."usedAt" IS NOT NULL
       AND (OLD."offeringId", OLD."createdById")
           IS DISTINCT FROM (NEW."offeringId", NEW."createdById") THEN
        RAISE EXCEPTION 'A used scope assignment code cannot change offering or creator'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ScopeAssignmentCode_identity_trigger"
BEFORE UPDATE OF "offeringId", "createdById"
ON "ScopeAssignmentCode"
FOR EACH ROW EXECUTE FUNCTION "prevent_scope_assignment_code_identity_change"();

-- A role change must remain compatible with every existing offering scope.
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
        FROM "ScopeAssignment" scope
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

-- An offering referenced by assessments, scopes or unused/used codes cannot be moved.
CREATE OR REPLACE FUNCTION "preventLinkedOfferingMove"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW."subjectId", NEW."termId") IS DISTINCT FROM (OLD."subjectId", OLD."termId")
       AND (
           EXISTS (SELECT 1 FROM "Assessment" WHERE "offeringId" = OLD.id)
           OR EXISTS (SELECT 1 FROM "ScopeAssignment" WHERE "offeringId" = OLD.id)
           OR EXISTS (SELECT 1 FROM "ScopeAssignmentCode" WHERE "offeringId" = OLD.id)
       )
    THEN
        RAISE EXCEPTION 'An offering with assessments, scope assignments or codes cannot move';
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;

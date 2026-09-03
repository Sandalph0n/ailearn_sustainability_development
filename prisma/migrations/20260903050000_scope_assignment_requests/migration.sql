-- A role request grants identity; this request grants an existing OFFERING role a concrete scope.

BEGIN;

CREATE TYPE "ScopeAssignmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ScopeAssignmentRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roleAssignmentId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ScopeAssignmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "processedByUserId" UUID,
    "approvedScopeAssignmentId" UUID,

    CONSTRAINT "ScopeAssignmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScopeAssignmentRequest_approvedScopeAssignmentId_key"
ON "ScopeAssignmentRequest"("approvedScopeAssignmentId");

CREATE INDEX "ScopeAssignmentRequest_roleAssignmentId_idx"
ON "ScopeAssignmentRequest"("roleAssignmentId");

CREATE INDEX "ScopeAssignmentRequest_offeringId_status_idx"
ON "ScopeAssignmentRequest"("offeringId", "status");

CREATE UNIQUE INDEX "ScopeAssignmentRequest_one_pending_request"
ON "ScopeAssignmentRequest"("roleAssignmentId", "offeringId")
WHERE "status" = 'PENDING';

ALTER TABLE "ScopeAssignmentRequest"
ADD CONSTRAINT "ScopeAssignmentRequest_roleAssignmentId_fkey"
FOREIGN KEY ("roleAssignmentId") REFERENCES "RoleAssignment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ScopeAssignmentRequest_offeringId_fkey"
FOREIGN KEY ("offeringId") REFERENCES "Offering"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ScopeAssignmentRequest_processedByUserId_fkey"
FOREIGN KEY ("processedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ScopeAssignmentRequest_approvedScopeAssignmentId_fkey"
FOREIGN KEY ("approvedScopeAssignmentId") REFERENCES "ScopeAssignment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "check_scope_assignment_request"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    assignment_scope "RoleScopeType";
    assignment_institution UUID;
    assignment_revoked_at TIMESTAMP(3);
    offering_institution UUID;
BEGIN
    IF TG_OP = 'UPDATE'
       AND (OLD."roleAssignmentId", OLD."offeringId")
           IS DISTINCT FROM (NEW."roleAssignmentId", NEW."offeringId") THEN
        RAISE EXCEPTION 'A scope request target is immutable'
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
        RAISE EXCEPTION 'Only offering roles can request an offering scope'
            USING ERRCODE = '23514';
    END IF;

    IF assignment_revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'A revoked role assignment cannot request an offering scope'
            USING ERRCODE = '23514';
    END IF;

    IF assignment_institution IS DISTINCT FROM offering_institution THEN
        RAISE EXCEPTION 'Role assignment and offering must belong to the same institution'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "ScopeAssignment" scope
        WHERE scope."roleAssignmentId" = NEW."roleAssignmentId"
          AND scope."offeringId" = NEW."offeringId"
    ) THEN
        RAISE EXCEPTION 'Role assignment already has this offering scope'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ScopeAssignmentRequest_validate_trigger"
BEFORE INSERT OR UPDATE OF "roleAssignmentId", "offeringId"
ON "ScopeAssignmentRequest"
FOR EACH ROW EXECUTE FUNCTION "check_scope_assignment_request"();

-- A role cannot be changed in a way that invalidates either granted or requested scopes.
CREATE OR REPLACE FUNCTION "check_role_assignment_role_change"()
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
        FROM (
            SELECT "offeringId"
            FROM "ScopeAssignment"
            WHERE "roleAssignmentId" = OLD.id
            UNION
            SELECT "offeringId"
            FROM "ScopeAssignmentRequest"
            WHERE "roleAssignmentId" = OLD.id
        ) linked
        JOIN "Offering" offering ON offering.id = linked."offeringId"
        JOIN "Subject" subject ON subject.id = offering."subjectId"
        WHERE new_role_scope IS DISTINCT FROM 'OFFERING'
           OR subject."institutionId" IS DISTINCT FROM new_role_institution
    ) THEN
        RAISE EXCEPTION 'The new role is incompatible with existing or requested offering scopes'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

-- Requests are historical links too, so an offering with one cannot move to another subject/term.
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
           OR EXISTS (SELECT 1 FROM "ScopeAssignmentRequest" WHERE "offeringId" = OLD.id)
       )
    THEN
        RAISE EXCEPTION 'An offering with assessments, scope records or codes cannot move';
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;

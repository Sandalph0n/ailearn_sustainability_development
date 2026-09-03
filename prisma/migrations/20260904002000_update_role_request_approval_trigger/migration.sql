-- RoleAssignment.offeringId was replaced by ScopeAssignment in
-- 20260903030000_role_assignment_offering_scopes. Keep approval validation aligned with the
-- current model: a role request creates one active, non-direct assignment with no initial scopes.
CREATE OR REPLACE FUNCTION "validateRoleRequestApproval"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    assignment_user UUID;
    assignment_role UUID;
    assignment_direct_granter UUID;
    assignment_revoked_at TIMESTAMP(3);
BEGIN
    IF NEW.status <> 'APPROVED' THEN
        RETURN NEW;
    END IF;

    SELECT
        "userId",
        "roleId",
        "grantDirectlyById",
        "roleRevokedAt"
    INTO
        assignment_user,
        assignment_role,
        assignment_direct_granter,
        assignment_revoked_at
    FROM "RoleAssignment"
    WHERE id = NEW."approvedAssignmentId";

    IF assignment_user IS DISTINCT FROM NEW."userId"
       OR assignment_role IS DISTINCT FROM NEW."roleId"
       OR assignment_direct_granter IS NOT NULL
       OR assignment_revoked_at IS NOT NULL
       OR EXISTS (
           SELECT 1
           FROM "ScopeAssignment"
           WHERE "roleAssignmentId" = NEW."approvedAssignmentId"
       )
    THEN
        RAISE EXCEPTION 'Approved assignment must be an active, unscoped assignment created for the requested user and role'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

-- Cho phép xin role OFFERING ở cấp institution. Khi được duyệt, assignment bắt đầu ở trạng
-- thái chưa scope (`offeringId` NULL) và chưa cấp quyền trên bất kỳ offering nào.

CREATE OR REPLACE FUNCTION "check_role_assignment_scope"()
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

    -- OFFERING + NULL là role identity chưa scope, nên hợp lệ nhưng chưa cấp quyền ở đâu.
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

CREATE OR REPLACE FUNCTION "check_role_request_scope"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    role_institution UUID;
BEGIN
    SELECT "institutionId" INTO role_institution
    FROM "Role" WHERE "id" = NEW."roleId";

    IF role_institution IS DISTINCT FROM NEW."institutionId" THEN
        RAISE EXCEPTION 'Role request and role must belong to the same institution'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

ALTER TRIGGER "RoleRequest_institution_role_only"
ON "RoleRequest"
RENAME TO "RoleRequest_same_institution";

ALTER INDEX "RoleAssignment_one_active_institution_role"
RENAME TO "RoleAssignment_one_active_unscoped_role";

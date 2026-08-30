-- RoleRequest là lịch sử nghiệp vụ, nên institution hoặc assignment không được xoá kéo theo.
ALTER TABLE "RoleRequest"
DROP CONSTRAINT "RoleRequest_institutionId_fkey",
DROP CONSTRAINT "RoleRequest_approvedAssignmentId_fkey";

ALTER TABLE "RoleRequest"
ADD CONSTRAINT "RoleRequest_institutionId_fkey"
FOREIGN KEY ("institutionId") REFERENCES "Institution"(id)
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "RoleRequest_approvedAssignmentId_fkey"
FOREIGN KEY ("approvedAssignmentId") REFERENCES "RoleAssignment"(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ba trạng thái có ba hình dạng dữ liệu rõ ràng; không chấp nhận request nửa xử lý.
ALTER TABLE "RoleRequest"
ADD CONSTRAINT "RoleRequest_status_shape_check"
CHECK (
    (status = 'PENDING' AND "processedAt" IS NULL AND "approvedAssignmentId" IS NULL)
    OR (status = 'REJECTED' AND "processedAt" IS NOT NULL AND "approvedAssignmentId" IS NULL)
    OR (status = 'APPROVED' AND "processedAt" IS NOT NULL AND "approvedAssignmentId" IS NOT NULL)
);

-- Assignment sinh từ request phải đúng người, đúng role và ở scope institution.
CREATE OR REPLACE FUNCTION "validateRoleRequestApproval"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    assignment_user uuid;
    assignment_role uuid;
    assignment_offering uuid;
BEGIN
    IF NEW.status <> 'APPROVED' THEN
        RETURN NEW;
    END IF;

    SELECT "userId", "roleId", "offeringId"
    INTO assignment_user, assignment_role, assignment_offering
    FROM "RoleAssignment"
    WHERE id = NEW."approvedAssignmentId";

    IF assignment_user IS DISTINCT FROM NEW."userId"
       OR assignment_role IS DISTINCT FROM NEW."roleId"
       OR assignment_offering IS NOT NULL
    THEN
        RAISE EXCEPTION 'Approved assignment must match request user and institution role';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "RoleRequest_validate_approval_trigger"
BEFORE INSERT OR UPDATE OF status, "approvedAssignmentId", "userId", "roleId" ON "RoleRequest"
FOR EACH ROW
EXECUTE FUNCTION "validateRoleRequestApproval"();

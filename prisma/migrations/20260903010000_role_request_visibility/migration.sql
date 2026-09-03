CREATE TABLE "RoleRequestVisibility" (
    "requestableRoleId" UUID NOT NULL,
    "requiredRoleId" UUID NOT NULL,

    CONSTRAINT "RoleRequestVisibility_pkey"
        PRIMARY KEY ("requestableRoleId", "requiredRoleId"),
    CONSTRAINT "RoleRequestVisibility_distinct_roles_check"
        CHECK ("requestableRoleId" <> "requiredRoleId")
);

CREATE INDEX "RoleRequestVisibility_requiredRoleId_idx"
ON "RoleRequestVisibility"("requiredRoleId");

ALTER TABLE "RoleRequestVisibility"
ADD CONSTRAINT "RoleRequestVisibility_requestableRoleId_fkey"
FOREIGN KEY ("requestableRoleId") REFERENCES "Role"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoleRequestVisibility"
ADD CONSTRAINT "RoleRequestVisibility_requiredRoleId_fkey"
FOREIGN KEY ("requiredRoleId") REFERENCES "Role"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Hai đầu của một điều kiện visibility phải thuộc cùng một institution.
CREATE FUNCTION "check_role_request_visibility"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    requestable_institution UUID;
    required_institution UUID;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('ailearn.role-request-visibility'));

    SELECT "institutionId" INTO requestable_institution
    FROM "Role"
    WHERE id = NEW."requestableRoleId";

    SELECT "institutionId" INTO required_institution
    FROM "Role"
    WHERE id = NEW."requiredRoleId";

    IF requestable_institution IS DISTINCT FROM required_institution THEN
        RAISE EXCEPTION 'Role request visibility roles must belong to the same institution'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "RoleRequestVisibility_validate_trigger"
BEFORE INSERT OR UPDATE OF "requestableRoleId", "requiredRoleId"
ON "RoleRequestVisibility"
FOR EACH ROW
EXECUTE FUNCTION "check_role_request_visibility"();

-- Một role đang tham gia điều kiện visibility không được chuyển sang institution khác.
CREATE OR REPLACE FUNCTION "prevent_linked_role_institution_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('ailearn.role-request-visibility'));

    IF OLD."institutionId" IS DISTINCT FROM NEW."institutionId"
       AND (
           EXISTS (
               SELECT 1
               FROM "RoleInclusion" edge
               WHERE edge."includingRoleId" = OLD.id OR edge."includedRoleId" = OLD.id
           )
           OR EXISTS (
               SELECT 1
               FROM "RoleRequestVisibility" visibility
               WHERE visibility."requestableRoleId" = OLD.id
                  OR visibility."requiredRoleId" = OLD.id
           )
       ) THEN
        RAISE EXCEPTION 'A linked role cannot be moved to another institution'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

-- Giữ lịch sử nhưng không cho hai request PENDING giống nhau cùng tồn tại.
CREATE UNIQUE INDEX "RoleRequest_one_pending_request"
ON "RoleRequest"("userId", "institutionId", "roleId")
WHERE status = 'PENDING';

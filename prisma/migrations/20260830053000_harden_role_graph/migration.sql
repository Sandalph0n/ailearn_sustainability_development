BEGIN;

-- Migration trước tạo trigger sau khi chép cạnh cũ, nên phải kiểm riêng dữ liệu đã tồn tại.
DO $$
BEGIN
    IF EXISTS (
        WITH RECURSIVE reach("fromId", "toId") AS (
            SELECT "includingRoleId", "includedRoleId"
            FROM "RoleInclusion"

            UNION

            SELECT reach."fromId", edge."includedRoleId"
            FROM reach
            JOIN "RoleInclusion" edge ON edge."includingRoleId" = reach."toId"
        )
        SELECT 1
        FROM reach
        WHERE "fromId" = "toId"
    ) THEN
        RAISE EXCEPTION 'Existing role inclusion graph contains a cycle';
    END IF;
END;
$$;

-- Loại cạnh OLD khỏi phép kiểm khi UPDATE trực tiếp, để trạng thái cuối hợp lệ không bị từ chối
-- chỉ vì trigger còn nhìn thấy giá trị trước update.
CREATE OR REPLACE FUNCTION "check_role_inclusion"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    including_institution UUID;
    included_institution UUID;
    old_including_role UUID := NULL;
    old_included_role UUID := NULL;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('ailearn.role-inclusion'));

    IF TG_OP = 'UPDATE' THEN
        old_including_role := OLD."includingRoleId";
        old_included_role := OLD."includedRoleId";
    END IF;

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
              AND NOT (
                  edge."includingRoleId" IS NOT DISTINCT FROM old_including_role
                  AND edge."includedRoleId" IS NOT DISTINCT FROM old_included_role
              )

            UNION

            SELECT edge."includedRoleId"
            FROM "RoleInclusion" edge
            JOIN descendants current ON current."roleId" = edge."includingRoleId"
            WHERE NOT (
                edge."includingRoleId" IS NOT DISTINCT FROM old_including_role
                AND edge."includedRoleId" IS NOT DISTINCT FROM old_included_role
            )
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

-- Cạnh có thể trở thành cross-institution nếu chỉ sửa Role mà không chạm RoleInclusion.
CREATE FUNCTION "prevent_linked_role_institution_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."institutionId" IS DISTINCT FROM NEW."institutionId"
       AND EXISTS (
           SELECT 1
           FROM "RoleInclusion" edge
           WHERE edge."includingRoleId" = OLD."id" OR edge."includedRoleId" = OLD."id"
       ) THEN
        RAISE EXCEPTION 'A linked role cannot be moved to another institution'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Role_keep_linked_institution"
BEFORE UPDATE OF "institutionId" ON "Role"
FOR EACH ROW
EXECUTE FUNCTION "prevent_linked_role_institution_change"();

COMMIT;

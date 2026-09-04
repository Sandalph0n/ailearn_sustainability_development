BEGIN;

-- Permission only names an action. Its effective boundary comes from the assigned Role and the
-- resource checked by the authorization guard.
ALTER TABLE "Permission" DROP COLUMN "type";
DROP TYPE "PermissionType";

ALTER TABLE "Role" ADD COLUMN "roleCode" TEXT;

-- Preserve readable labels while introducing stable, scope-prefixed identifiers. Known reference
-- roles get deliberate codes; arbitrary existing roles receive a deterministic code derived from
-- their label. A short id suffix resolves duplicate labels without discarding either role.
WITH candidates AS (
    SELECT
        "id",
        "institutionId",
        CASE "id"::text
            WHEN '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf' THEN 'institution:staff'
            WHEN 'd25951cc-f23a-5c4d-8bcc-98ae881fba46' THEN 'offering:tutor'
            WHEN 'ea2e69b1-c5d7-5931-8249-29a06fc8371b' THEN 'offering:offering.manager'
            WHEN 'c14226dd-1cd5-42de-8832-93169e7f40be' THEN 'offering:student'
            WHEN '8b13ad48-7945-46d8-afde-f9e7bc1c7b90' THEN 'institution:subject.viewer'
            WHEN '6356d6d1-d512-4de3-bc98-ffc13052122b' THEN 'institution:subject.editor'
            WHEN '3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec' THEN 'institution:subject.manager'
            WHEN '1e2b9a93-123b-4b55-bbeb-65384e647240' THEN 'institution:term.manager'
            WHEN '537ca3f2-5bea-41ae-b420-b6a7a6d2dd10' THEN 'institution:offering.manager'
            WHEN '01899d3c-7a74-46eb-a141-075c8b4cdf6b' THEN 'institution:manager'
            ELSE lower("scopeType"::text) || ':' || COALESCE(
                NULLIF(
                    trim(BOTH '.' FROM regexp_replace(lower("roleName"), '[^a-z0-9]+', '.', 'g')),
                    ''
                ),
                'role'
            )
        END AS candidate
    FROM "Role"
), ranked AS (
    SELECT
        "id",
        candidate,
        row_number() OVER (
            PARTITION BY "institutionId", candidate
            ORDER BY "id"
        ) AS duplicate_number
    FROM candidates
)
UPDATE "Role" AS role
SET "roleCode" = ranked.candidate || CASE
    WHEN ranked.duplicate_number = 1 THEN ''
    ELSE '.' || left(replace(role."id"::text, '-', ''), 8)
END
FROM ranked
WHERE ranked."id" = role."id";

ALTER TABLE "Role" ALTER COLUMN "roleCode" SET NOT NULL;
ALTER TABLE "Role"
    ADD CONSTRAINT "Role_roleCode_format" CHECK (
        "roleCode" ~ '^(institution|offering):[a-z0-9]+([._-][a-z0-9]+)*$'
    ),
    ADD CONSTRAINT "Role_roleCode_scope" CHECK (
        ("scopeType" = 'INSTITUTION' AND "roleCode" LIKE 'institution:%') OR
        ("scopeType" = 'OFFERING' AND "roleCode" LIKE 'offering:%')
    );
CREATE UNIQUE INDEX "Role_institutionId_roleCode_key"
    ON "Role"("institutionId", "roleCode");

-- Existing inclusions are valid only when both roles use the same boundary model.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "RoleInclusion" edge
        JOIN "Role" including_role ON including_role."id" = edge."includingRoleId"
        JOIN "Role" included_role ON included_role."id" = edge."includedRoleId"
        WHERE including_role."scopeType" IS DISTINCT FROM included_role."scopeType"
    ) THEN
        RAISE EXCEPTION 'Existing role inclusions contain different scope types';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "check_role_inclusion"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    including_institution UUID;
    included_institution UUID;
    including_scope "RoleScopeType";
    included_scope "RoleScopeType";
    old_including_role UUID := NULL;
    old_included_role UUID := NULL;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('ailearn.role-inclusion'));

    IF TG_OP = 'UPDATE' THEN
        old_including_role := OLD."includingRoleId";
        old_included_role := OLD."includedRoleId";
    END IF;

    SELECT "institutionId", "scopeType"
    INTO including_institution, including_scope
    FROM "Role"
    WHERE "id" = NEW."includingRoleId";

    SELECT "institutionId", "scopeType"
    INTO included_institution, included_scope
    FROM "Role"
    WHERE "id" = NEW."includedRoleId";

    IF including_institution IS DISTINCT FROM included_institution THEN
        RAISE EXCEPTION 'Included roles must belong to the same institution'
            USING ERRCODE = '23514';
    END IF;

    IF including_scope IS DISTINCT FROM included_scope THEN
        RAISE EXCEPTION 'Included roles must use the same scope type'
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

-- A linked role cannot change institution or scope without invalidating existing graph edges.
DROP TRIGGER "Role_keep_linked_institution" ON "Role";
DROP FUNCTION "prevent_linked_role_institution_change"();

CREATE FUNCTION "prevent_linked_role_context_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (
        OLD."institutionId" IS DISTINCT FROM NEW."institutionId" OR
        OLD."scopeType" IS DISTINCT FROM NEW."scopeType"
    ) AND EXISTS (
        SELECT 1
        FROM "RoleInclusion" edge
        WHERE edge."includingRoleId" = OLD."id" OR edge."includedRoleId" = OLD."id"
    ) THEN
        RAISE EXCEPTION 'A linked role cannot change institution or scope type'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Role_keep_linked_context"
BEFORE UPDATE OF "institutionId", "scopeType" ON "Role"
FOR EACH ROW
EXECUTE FUNCTION "prevent_linked_role_context_change"();

COMMIT;

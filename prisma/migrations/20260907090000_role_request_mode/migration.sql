BEGIN;

CREATE TYPE "RoleRequestMode" AS ENUM ('DISABLED', 'PUBLIC', 'CONDITIONAL');

-- New roles are closed by default. Existing rows are backfilled below so this migration preserves
-- the pre-migration behaviour: no visibility rule meant public; at least one rule meant conditional.
ALTER TABLE "Role"
ADD COLUMN "requestMode" "RoleRequestMode" NOT NULL DEFAULT 'DISABLED';

UPDATE "Role" AS role
SET "requestMode" = CASE
    WHEN EXISTS (
        SELECT 1
        FROM "RoleRequestVisibility" AS visibility
        WHERE visibility."requestableRoleId" = role."id"
    ) THEN 'CONDITIONAL'::"RoleRequestMode"
    ELSE 'PUBLIC'::"RoleRequestMode"
END;

COMMIT;

-- Email auto-grant is evaluated while a user joins an institution, before an
-- offering exists in the request context. Remove legacy invalid values first,
-- then keep the business invariant at the database boundary.
UPDATE "Role"
SET "autoGrantEmailRegex" = NULL
WHERE "scopeType" = 'OFFERING'
  AND "autoGrantEmailRegex" IS NOT NULL;

ALTER TABLE "Role"
ADD CONSTRAINT "Role_auto_grant_institution_scope_check"
CHECK (
    "scopeType" = 'INSTITUTION'
    OR "autoGrantEmailRegex" IS NULL
);

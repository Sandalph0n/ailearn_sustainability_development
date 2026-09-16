-- Bring existing institution catalogs forward without requiring a full demo-data reseed.
-- Higher roles inherit from these assessment roles; Chief Management keeps a direct grant.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" AS role
JOIN "Permission" AS permission ON permission."permission" = 'attempt.mark'
WHERE role."roleCode" IN (
    'offering:tutor',
    'offering:assessment.manager',
    'institution:assessment.manager',
    'institution:chief.management'
)
AND NOT EXISTS (
    SELECT 1
    FROM "RolePermission" AS existing
    WHERE existing."roleId" = role."id"
      AND existing."permissionId" = permission."id"
      AND existing."revokedAt" IS NULL
);

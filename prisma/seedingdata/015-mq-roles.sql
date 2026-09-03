-- Small Macquarie role catalog for exercising role requests and role management.
-- Stable role ids plus NOT EXISTS on active permissions make this file safe to run repeatedly.

INSERT INTO "Role" ("id", "institutionId", "roleName", "autoGrantEmailRegex", "scopeType")
VALUES
  (
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'MQ Staff',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  ),
  (
    'd25951cc-f23a-5c4d-8bcc-98ae881fba46'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'Tutor',
    NULL,
    'OFFERING'::"RoleScopeType"
  ),
  (
    'ea2e69b1-c5d7-5931-8249-29a06fc8371b'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'Unit Convenor',
    NULL,
    'OFFERING'::"RoleScopeType"
  )
ON CONFLICT ("id") DO UPDATE
SET "roleName" = EXCLUDED."roleName",
    "autoGrantEmailRegex" = EXCLUDED."autoGrantEmailRegex";

WITH desired_permissions ("roleId", "permission") AS (
  VALUES
    ('9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid, 'member.view'),
    ('9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid, 'role.view'),
    ('9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid, 'role_request.review'),

    ('d25951cc-f23a-5c4d-8bcc-98ae881fba46'::uuid, 'assessment.view'),
    ('d25951cc-f23a-5c4d-8bcc-98ae881fba46'::uuid, 'attempt.view_all'),
    ('d25951cc-f23a-5c4d-8bcc-98ae881fba46'::uuid, 'member.view'),

    ('ea2e69b1-c5d7-5931-8249-29a06fc8371b'::uuid, 'assessment.manage'),
    ('ea2e69b1-c5d7-5931-8249-29a06fc8371b'::uuid, 'offering.manage'),
    ('ea2e69b1-c5d7-5931-8249-29a06fc8371b'::uuid, 'role_assignment.manage')
)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT desired_permissions."roleId", permission."id"
FROM desired_permissions
JOIN "Permission" AS permission
  ON permission."permission" = desired_permissions."permission"
WHERE NOT EXISTS (
  SELECT 1
  FROM "RolePermission" AS existing
  WHERE existing."roleId" = desired_permissions."roleId"
    AND existing."permissionId" = permission."id"
    AND existing."revokedAt" IS NULL
);

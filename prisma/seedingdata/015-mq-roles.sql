-- Small Macquarie role catalog for exercising role requests and role management.
-- Stable role ids plus NOT EXISTS on active permissions make this file safe to run repeatedly.

INSERT INTO "Role" ("id", "institutionId", "roleCode", "roleName", "autoGrantEmailRegex", "scopeType")
VALUES
  (
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'institution:staff',
    'MQ Staff',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  ),
  (
    'd25951cc-f23a-5c4d-8bcc-98ae881fba46'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'offering:tutor',
    'Tutor',
    NULL,
    'OFFERING'::"RoleScopeType"
  ),
  (
    'ea2e69b1-c5d7-5931-8249-29a06fc8371b'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'offering:offering.manager',
    'Unit Convenor',
    NULL,
    'OFFERING'::"RoleScopeType"
  ),
  (
    'c14226dd-1cd5-42de-8832-93169e7f40be'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'offering:student',
    'Student',
    NULL,
    'OFFERING'::"RoleScopeType"
  ),
  (
    '8b13ad48-7945-46d8-afde-f9e7bc1c7b90'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'institution:subject.viewer',
    'Subject Viewer',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  ),
  (
    '6356d6d1-d512-4de3-bc98-ffc13052122b'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'institution:subject.editor',
    'Subject Editor',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  ),
  (
    '3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'institution:subject.manager',
    'Subject Manager',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  ),
  (
    '1e2b9a93-123b-4b55-bbeb-65384e647240'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'institution:term.manager',
    'Term Manager',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  ),
  (
    '537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'institution:offering.manager',
    'Offering Manager',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  ),
  (
    '01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'institution:manager',
    'Institution Manager',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  ),
  (
    '2c073443-6ac8-5c17-bf5d-16b0ec3dbb64'::uuid,
    'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
    'institution:chief.management',
    'Chief Management',
    NULL,
    'INSTITUTION'::"RoleScopeType"
  )
ON CONFLICT ("id") DO UPDATE
SET "roleName" = EXCLUDED."roleName",
    "roleCode" = EXCLUDED."roleCode",
    "autoGrantEmailRegex" = EXCLUDED."autoGrantEmailRegex",
    "scopeType" = EXCLUDED."scopeType";

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
    ('ea2e69b1-c5d7-5931-8249-29a06fc8371b'::uuid, 'role_assignment.manage'),

    ('c14226dd-1cd5-42de-8832-93169e7f40be'::uuid, 'assessment.attempt'),

    ('8b13ad48-7945-46d8-afde-f9e7bc1c7b90'::uuid, 'subject.view'),

    ('6356d6d1-d512-4de3-bc98-ffc13052122b'::uuid, 'subject.create'),
    ('6356d6d1-d512-4de3-bc98-ffc13052122b'::uuid, 'subject.update'),

    ('3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec'::uuid, 'subject.delete'),

    ('1e2b9a93-123b-4b55-bbeb-65384e647240'::uuid, 'term.create'),
    ('1e2b9a93-123b-4b55-bbeb-65384e647240'::uuid, 'term.view'),
    ('1e2b9a93-123b-4b55-bbeb-65384e647240'::uuid, 'term.update'),
    ('1e2b9a93-123b-4b55-bbeb-65384e647240'::uuid, 'term.delete'),

    ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid, 'offering.create'),
    ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid, 'offering.view'),
    ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid, 'offering.update'),
    ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid, 'offering.delete'),
    ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid, 'assessment.create'),
    ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid, 'assessment.view'),
    ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid, 'assessment.update'),
    ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid, 'assessment.delete'),

    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'institution.settings.view'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'institution.settings.update'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'role.create'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'role.view'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'role.update'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'role.delete'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'role_request.review'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'member.view'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'role_assignment.manage'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'audit.view'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'attempt.view_all'),
    ('01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid, 'tool_session.replay_all')
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

-- Chief Management intentionally receives the complete current permission catalog directly.
-- Re-running this seed also grants permissions added to the catalog in a later migration.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT
  '2c073443-6ac8-5c17-bf5d-16b0ec3dbb64'::uuid,
  permission."id"
FROM "Permission" AS permission
WHERE NOT EXISTS (
  SELECT 1
  FROM "RolePermission" AS existing
  WHERE existing."roleId" = '2c073443-6ac8-5c17-bf5d-16b0ec3dbb64'::uuid
    AND existing."permissionId" = permission."id"
    AND existing."revokedAt" IS NULL
);

-- Subject roles form a small capability ladder. The manager receives all CRUD actions through
-- inheritance without storing the aggregate `subject.manage` permission directly.
INSERT INTO "RoleInclusion" ("includingRoleId", "includedRoleId")
VALUES
  (
    '6356d6d1-d512-4de3-bc98-ffc13052122b'::uuid,
    '8b13ad48-7945-46d8-afde-f9e7bc1c7b90'::uuid
  ),
  (
    '3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec'::uuid,
    '6356d6d1-d512-4de3-bc98-ffc13052122b'::uuid
  ),
  (
    '01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid,
    '3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec'::uuid
  ),
  (
    '01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid,
    '1e2b9a93-123b-4b55-bbeb-65384e647240'::uuid
  ),
  (
    '01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid,
    '537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid
  )
ON CONFLICT ("includingRoleId", "includedRoleId") DO NOTHING;

-- These privileged roles are only visible to people who already hold MQ Staff. Approval is still
-- a separate step; visibility never grants the role by itself.
INSERT INTO "RoleRequestVisibility" ("requestableRoleId", "requiredRoleId")
VALUES
  (
    '8b13ad48-7945-46d8-afde-f9e7bc1c7b90'::uuid,
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid
  ),
  (
    '6356d6d1-d512-4de3-bc98-ffc13052122b'::uuid,
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid
  ),
  (
    '3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec'::uuid,
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid
  ),
  (
    '1e2b9a93-123b-4b55-bbeb-65384e647240'::uuid,
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid
  ),
  (
    '537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'::uuid,
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid
  ),
  (
    '01899d3c-7a74-46eb-a141-075c8b4cdf6b'::uuid,
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid
  ),
  (
    '2c073443-6ac8-5c17-bf5d-16b0ec3dbb64'::uuid,
    '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'::uuid
  )
ON CONFLICT ("requestableRoleId", "requiredRoleId") DO NOTHING;

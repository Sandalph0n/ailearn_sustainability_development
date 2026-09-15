-- Canonical Macquarie role catalog.
-- Stable UUIDs and reconciliation queries make this safe to run repeatedly. RolePermission rows
-- are revoked rather than deleted so authorization history remains available for audit.

CREATE TEMP TABLE seed_mq_roles (
  "id" uuid PRIMARY KEY,
  "roleCode" text NOT NULL,
  "roleName" text NOT NULL,
  "scopeType" "RoleScopeType" NOT NULL,
  "requestMode" "RoleRequestMode" NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_mq_roles ("id", "roleCode", "roleName", "scopeType", "requestMode")
VALUES
  ('c14226dd-1cd5-42de-8832-93169e7f40be', 'offering:student', 'Student', 'OFFERING', 'PUBLIC'),
  ('9029e84d-bb51-5ba8-8a54-f6c282e9d7bf', 'institution:staff', 'Staff', 'INSTITUTION', 'PUBLIC'),
  ('d25951cc-f23a-5c4d-8bcc-98ae881fba46', 'offering:tutor', 'Tutor', 'OFFERING', 'CONDITIONAL'),
  ('54cddb9b-273a-4952-87c9-6c1deeee5b45', 'offering:assessment.manager', 'Assessment Manager', 'OFFERING', 'DISABLED'),
  ('c64a0c58-eeb6-44ff-966f-29c531ec0317', 'offering:offering.manager', 'Offering Manager', 'OFFERING', 'DISABLED'),
  ('ea2e69b1-c5d7-5931-8249-29a06fc8371b', 'offering:unit.convenor', 'Unit Convenor', 'OFFERING', 'CONDITIONAL'),
  ('8b13ad48-7945-46d8-afde-f9e7bc1c7b90', 'institution:subject.viewer', 'Subject Viewer', 'INSTITUTION', 'DISABLED'),
  ('6356d6d1-d512-4de3-bc98-ffc13052122b', 'institution:subject.editor', 'Subject Editor', 'INSTITUTION', 'DISABLED'),
  ('3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec', 'institution:subject.manager', 'Subject Manager', 'INSTITUTION', 'DISABLED'),
  ('1e2b9a93-123b-4b55-bbeb-65384e647240', 'institution:term.manager', 'Term Manager', 'INSTITUTION', 'DISABLED'),
  ('00371033-7e5d-4052-8a97-e522a19d2013', 'institution:assessment.manager', 'Assessment Manager', 'INSTITUTION', 'DISABLED'),
  ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10', 'institution:offering.manager', 'Offering Manager', 'INSTITUTION', 'DISABLED'),
  ('e700c8fc-c16b-4646-8b05-ea7ab48446f0', 'institution:academic.operations.manager', 'Academic Operations Manager', 'INSTITUTION', 'DISABLED'),
  ('150cfbe4-6944-437b-8ae8-c111de293ffd', 'institution:access.reviewer', 'Access Reviewer', 'INSTITUTION', 'DISABLED'),
  ('9cd59704-1c45-492f-babc-14147eaef167', 'institution:access.manager', 'Access Manager', 'INSTITUTION', 'DISABLED'),
  ('fb999d9d-1e28-4e1e-ac36-1be26a4e6543', 'institution:audit.viewer', 'Audit Viewer', 'INSTITUTION', 'DISABLED'),
  ('01899d3c-7a74-46eb-a141-075c8b4cdf6b', 'institution:administrator', 'Institution Administrator', 'INSTITUTION', 'DISABLED'),
  ('2c073443-6ac8-5c17-bf5d-16b0ec3dbb64', 'institution:chief.management', 'Chief Management', 'INSTITUTION', 'DISABLED');

-- Free renamed canonical codes before inserting newly split roles. In particular, the old Unit
-- Convenor used `offering:offering.manager`, which now belongs to a distinct role.
UPDATE "Role" AS existing
SET "roleCode" = desired."roleCode"
FROM seed_mq_roles AS desired
WHERE existing."id" = desired."id"
  AND existing."roleCode" IS DISTINCT FROM desired."roleCode";

INSERT INTO "Role" (
  "id", "institutionId", "roleCode", "roleName", "autoGrantEmailRegex", "scopeType", "requestMode"
)
SELECT
  role."id",
  'f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid,
  role."roleCode",
  role."roleName",
  CASE
    WHEN role."roleCode" = 'offering:student' THEN '@students\.mq\.edu\.au$'
    ELSE NULL
  END,
  role."scopeType",
  role."requestMode"
FROM seed_mq_roles AS role
ON CONFLICT ("id") DO UPDATE
SET "roleName" = EXCLUDED."roleName",
    "roleCode" = EXCLUDED."roleCode",
    "autoGrantEmailRegex" = EXCLUDED."autoGrantEmailRegex",
    "scopeType" = EXCLUDED."scopeType",
    "requestMode" = EXCLUDED."requestMode";

CREATE TEMP TABLE seed_mq_role_permissions (
  "roleId" uuid NOT NULL,
  "permission" text NOT NULL,
  PRIMARY KEY ("roleId", "permission")
) ON COMMIT DROP;

INSERT INTO seed_mq_role_permissions ("roleId", "permission")
VALUES
  -- Learner identity. Published-view is intentionally narrower than staff assessment.view.
  ('c14226dd-1cd5-42de-8832-93169e7f40be', 'offering.view'),
  ('c14226dd-1cd5-42de-8832-93169e7f40be', 'assessment.view_published'),
  ('c14226dd-1cd5-42de-8832-93169e7f40be', 'assessment.attempt'),
  ('c14226dd-1cd5-42de-8832-93169e7f40be', 'attempt.view_own'),
  ('c14226dd-1cd5-42de-8832-93169e7f40be', 'tool.launch'),
  ('c14226dd-1cd5-42de-8832-93169e7f40be', 'tool_session.replay_own'),

  -- Institution catalog access without administrative mutation.
  ('9029e84d-bb51-5ba8-8a54-f6c282e9d7bf', 'institution.settings.view'),
  ('9029e84d-bb51-5ba8-8a54-f6c282e9d7bf', 'subject.view'),
  ('9029e84d-bb51-5ba8-8a54-f6c282e9d7bf', 'term.view'),
  ('9029e84d-bb51-5ba8-8a54-f6c282e9d7bf', 'offering.view'),

  ('d25951cc-f23a-5c4d-8bcc-98ae881fba46', 'offering.view'),
  ('d25951cc-f23a-5c4d-8bcc-98ae881fba46', 'assessment.view'),
  ('d25951cc-f23a-5c4d-8bcc-98ae881fba46', 'attempt.view_all'),
  ('d25951cc-f23a-5c4d-8bcc-98ae881fba46', 'tool_session.replay_all'),
  ('d25951cc-f23a-5c4d-8bcc-98ae881fba46', 'member.view'),

  ('54cddb9b-273a-4952-87c9-6c1deeee5b45', 'assessment.manage'),
  ('54cddb9b-273a-4952-87c9-6c1deeee5b45', 'attempt.view_all'),
  ('54cddb9b-273a-4952-87c9-6c1deeee5b45', 'tool_session.replay_all'),
  ('c64a0c58-eeb6-44ff-966f-29c531ec0317', 'offering.view'),
  ('c64a0c58-eeb6-44ff-966f-29c531ec0317', 'offering.update'),
  ('c64a0c58-eeb6-44ff-966f-29c531ec0317', 'offering.delete'),
  ('c64a0c58-eeb6-44ff-966f-29c531ec0317', 'member.view'),

  -- Granular subject ladder: viewer < editor < manager.
  ('8b13ad48-7945-46d8-afde-f9e7bc1c7b90', 'subject.view'),
  ('6356d6d1-d512-4de3-bc98-ffc13052122b', 'subject.create'),
  ('6356d6d1-d512-4de3-bc98-ffc13052122b', 'subject.update'),
  ('3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec', 'subject.delete'),
  ('1e2b9a93-123b-4b55-bbeb-65384e647240', 'term.manage'),
  ('00371033-7e5d-4052-8a97-e522a19d2013', 'assessment.manage'),
  ('00371033-7e5d-4052-8a97-e522a19d2013', 'attempt.view_all'),
  ('00371033-7e5d-4052-8a97-e522a19d2013', 'tool_session.replay_all'),
  ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10', 'offering.create'),
  ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10', 'offering.manage'),
  ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10', 'member.view'),

  ('150cfbe4-6944-437b-8ae8-c111de293ffd', 'member.view'),
  ('150cfbe4-6944-437b-8ae8-c111de293ffd', 'role_request.review'),
  ('150cfbe4-6944-437b-8ae8-c111de293ffd', 'scope_request.review'),
  ('150cfbe4-6944-437b-8ae8-c111de293ffd', 'role_assignment.view'),
  ('150cfbe4-6944-437b-8ae8-c111de293ffd', 'scope_assignment.view'),

  ('9cd59704-1c45-492f-babc-14147eaef167', 'role.manage'),
  ('9cd59704-1c45-492f-babc-14147eaef167', 'role_assignment.manage'),
  ('9cd59704-1c45-492f-babc-14147eaef167', 'scope_assignment.manage'),
  ('9cd59704-1c45-492f-babc-14147eaef167', 'scope_assignment_code.manage'),

  ('fb999d9d-1e28-4e1e-ac36-1be26a4e6543', 'audit.view'),
  ('01899d3c-7a74-46eb-a141-075c8b4cdf6b', 'institution.settings.manage');

-- Chief Management receives every current catalog permission directly, including permissions
-- added by later development before this seed is run again.
INSERT INTO seed_mq_role_permissions ("roleId", "permission")
SELECT '2c073443-6ac8-5c17-bf5d-16b0ec3dbb64'::uuid, permission."permission"
FROM "Permission" AS permission
ON CONFLICT ("roleId", "permission") DO NOTHING;

UPDATE "RolePermission" AS role_permission
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE role_permission."revokedAt" IS NULL
  AND role_permission."roleId" IN (SELECT "id" FROM seed_mq_roles)
  AND NOT EXISTS (
    SELECT 1
    FROM seed_mq_role_permissions AS desired
    JOIN "Permission" AS permission ON permission."permission" = desired."permission"
    WHERE desired."roleId" = role_permission."roleId"
      AND permission."id" = role_permission."permissionId"
  );

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT desired."roleId", permission."id"
FROM seed_mq_role_permissions AS desired
JOIN "Permission" AS permission ON permission."permission" = desired."permission"
WHERE NOT EXISTS (
  SELECT 1
  FROM "RolePermission" AS existing
  WHERE existing."roleId" = desired."roleId"
    AND existing."permissionId" = permission."id"
    AND existing."revokedAt" IS NULL
);

CREATE TEMP TABLE seed_mq_role_inclusions (
  "includingRoleId" uuid NOT NULL,
  "includedRoleId" uuid NOT NULL,
  PRIMARY KEY ("includingRoleId", "includedRoleId")
) ON COMMIT DROP;

INSERT INTO seed_mq_role_inclusions ("includingRoleId", "includedRoleId")
VALUES
  -- Offering-scoped DAG.
  ('c64a0c58-eeb6-44ff-966f-29c531ec0317', '54cddb9b-273a-4952-87c9-6c1deeee5b45'),
  ('ea2e69b1-c5d7-5931-8249-29a06fc8371b', 'c64a0c58-eeb6-44ff-966f-29c531ec0317'),
  ('ea2e69b1-c5d7-5931-8249-29a06fc8371b', 'd25951cc-f23a-5c4d-8bcc-98ae881fba46'),

  -- Institution-scoped DAG.
  ('6356d6d1-d512-4de3-bc98-ffc13052122b', '8b13ad48-7945-46d8-afde-f9e7bc1c7b90'),
  ('3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec', '6356d6d1-d512-4de3-bc98-ffc13052122b'),
  ('537ca3f2-5bea-41ae-b420-b6a7a6d2dd10', '00371033-7e5d-4052-8a97-e522a19d2013'),
  ('e700c8fc-c16b-4646-8b05-ea7ab48446f0', '3b3e115b-b7e0-4f5a-8e5c-8ea278e100ec'),
  ('e700c8fc-c16b-4646-8b05-ea7ab48446f0', '1e2b9a93-123b-4b55-bbeb-65384e647240'),
  ('e700c8fc-c16b-4646-8b05-ea7ab48446f0', '537ca3f2-5bea-41ae-b420-b6a7a6d2dd10'),
  ('9cd59704-1c45-492f-babc-14147eaef167', '150cfbe4-6944-437b-8ae8-c111de293ffd'),
  ('01899d3c-7a74-46eb-a141-075c8b4cdf6b', '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'),
  ('01899d3c-7a74-46eb-a141-075c8b4cdf6b', 'e700c8fc-c16b-4646-8b05-ea7ab48446f0'),
  ('01899d3c-7a74-46eb-a141-075c8b4cdf6b', '9cd59704-1c45-492f-babc-14147eaef167'),
  ('01899d3c-7a74-46eb-a141-075c8b4cdf6b', 'fb999d9d-1e28-4e1e-ac36-1be26a4e6543'),
  ('2c073443-6ac8-5c17-bf5d-16b0ec3dbb64', '01899d3c-7a74-46eb-a141-075c8b4cdf6b');

DELETE FROM "RoleInclusion" AS existing
WHERE existing."includingRoleId" IN (SELECT "id" FROM seed_mq_roles)
  AND NOT EXISTS (
    SELECT 1
    FROM seed_mq_role_inclusions AS desired
    WHERE desired."includingRoleId" = existing."includingRoleId"
      AND desired."includedRoleId" = existing."includedRoleId"
  );

INSERT INTO "RoleInclusion" ("includingRoleId", "includedRoleId")
SELECT desired."includingRoleId", desired."includedRoleId"
FROM seed_mq_role_inclusions AS desired
ON CONFLICT ("includingRoleId", "includedRoleId") DO NOTHING;

CREATE TEMP TABLE seed_mq_role_visibility (
  "requestableRoleId" uuid NOT NULL,
  "requiredRoleId" uuid NOT NULL,
  PRIMARY KEY ("requestableRoleId", "requiredRoleId")
) ON COMMIT DROP;

-- Multiple rows for Unit Convenor are OR conditions: Staff OR Tutor.
INSERT INTO seed_mq_role_visibility ("requestableRoleId", "requiredRoleId")
VALUES
  ('d25951cc-f23a-5c4d-8bcc-98ae881fba46', '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'),
  ('ea2e69b1-c5d7-5931-8249-29a06fc8371b', '9029e84d-bb51-5ba8-8a54-f6c282e9d7bf'),
  ('ea2e69b1-c5d7-5931-8249-29a06fc8371b', 'd25951cc-f23a-5c4d-8bcc-98ae881fba46');

DELETE FROM "RoleRequestVisibility" AS existing
WHERE existing."requestableRoleId" IN (SELECT "id" FROM seed_mq_roles);

INSERT INTO "RoleRequestVisibility" ("requestableRoleId", "requiredRoleId")
SELECT "requestableRoleId", "requiredRoleId"
FROM seed_mq_role_visibility;

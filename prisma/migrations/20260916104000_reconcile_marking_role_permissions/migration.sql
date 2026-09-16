-- Existing institutions may have been seeded before Marking & Replay was introduced. Reconcile
-- the base roles only; higher roles receive the same capabilities through RoleInclusion, keeping
-- inherited permissions visible as inherited in the role editor instead of duplicating grants.
WITH desired("roleCode", "permission") AS (
    VALUES
        ('offering:tutor', 'assessment.view'),
        ('offering:tutor', 'attempt.view_all'),
        ('offering:tutor', 'tool_session.replay_all'),
        ('offering:tutor', 'attempt.mark'),

        ('offering:assessment.manager', 'assessment.manage'),
        ('offering:assessment.manager', 'attempt.view_all'),
        ('offering:assessment.manager', 'tool_session.replay_all'),
        ('offering:assessment.manager', 'attempt.mark'),

        ('institution:assessment.manager', 'assessment.manage'),
        ('institution:assessment.manager', 'attempt.view_all'),
        ('institution:assessment.manager', 'tool_session.replay_all'),
        ('institution:assessment.manager', 'attempt.mark'),

        ('institution:chief.management', 'assessment.view'),
        ('institution:chief.management', 'attempt.view_all'),
        ('institution:chief.management', 'tool_session.replay_all'),
        ('institution:chief.management', 'attempt.mark')
)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM desired
JOIN "Role" AS role ON role."roleCode" = desired."roleCode"
JOIN "Permission" AS permission ON permission."permission" = desired."permission"
WHERE NOT EXISTS (
    SELECT 1
    FROM "RolePermission" AS existing
    WHERE existing."roleId" = role."id"
      AND existing."permissionId" = permission."id"
      AND existing."revokedAt" IS NULL
);

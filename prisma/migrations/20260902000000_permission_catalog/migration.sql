-- Permission applicability is part of the platform-owned permission vocabulary.
-- `I` is institution-only; `IO` can apply institution-wide or to one offering.
CREATE TYPE "PermissionType" AS ENUM ('I', 'IO');

ALTER TABLE "Permission"
ADD COLUMN "type" "PermissionType" NOT NULL DEFAULT 'I';

-- These rows are reference data required by authorization code, not demo data.
-- Upsert by the stable permission code so an environment with manually created
-- rows is brought back to the canonical descriptions and applicability.
INSERT INTO "Permission" ("permission", "type", "description")
VALUES
    (
        'institution.settings.manage',
        'I',
        'Manage institution settings.'
    ),
    (
        'subject.manage',
        'I',
        'Create, update, and delete subjects.'
    ),
    (
        'term.manage',
        'I',
        'Manage study terms and their periods.'
    ),
    (
        'offering.create',
        'I',
        'Create subject offerings within the institution.'
    ),
    (
        'role_request.review',
        'I',
        'Approve or reject requests to join the institution.'
    ),
    (
        'role.view',
        'I',
        'View role definitions, permissions, and inheritance.'
    ),
    (
        'role.manage',
        'I',
        'Create, update, and delete institution roles.'
    ),
    (
        'audit.view',
        'I',
        'View institution authorization and administration history.'
    ),
    (
        'offering.view',
        'IO',
        'View offerings and their learning information.'
    ),
    (
        'offering.manage',
        'IO',
        'Update or delete offerings within the assigned scope.'
    ),
    (
        'member.view',
        'IO',
        'View members and their roles within the assigned scope.'
    ),
    (
        'role_assignment.manage',
        'IO',
        'Grant and revoke roles within the assigned scope.'
    ),
    (
        'assessment.view',
        'IO',
        'View assessments and their configuration.'
    ),
    (
        'assessment.manage',
        'IO',
        'Create, update, and delete assessments.'
    ),
    (
        'assessment.attempt',
        'IO',
        'Start and submit assessment attempts.'
    ),
    (
        'attempt.view_own',
        'IO',
        'View the current user''s own assessment attempts.'
    ),
    (
        'attempt.view_all',
        'IO',
        'View assessment attempts belonging to other members in scope.'
    ),
    (
        'tool.launch',
        'IO',
        'Launch tools allowed by an assessment.'
    ),
    (
        'tool_session.replay_own',
        'IO',
        'Replay the current user''s own tool sessions.'
    ),
    (
        'tool_session.replay_all',
        'IO',
        'Replay tool sessions belonging to other members in scope.'
    )
ON CONFLICT ("permission")
DO UPDATE SET
    "type" = EXCLUDED."type",
    "description" = EXCLUDED."description";

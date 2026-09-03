-- Permission codes are application-owned reference data. CRUD actions are separate so a role can
-- be read-only or edit without delete; `manage` remains the backwards-compatible aggregate.
INSERT INTO "Permission" ("permission", "type", "description")
VALUES
    ('institution.settings.view', 'I', 'View institution settings.'),
    ('institution.settings.update', 'I', 'Update institution settings.'),
    ('institution.settings.manage', 'I', 'View and update institution settings.'),

    ('subject.create', 'I', 'Create subjects within the institution.'),
    ('subject.view', 'I', 'View subjects within the institution.'),
    ('subject.update', 'I', 'Update subjects within the institution.'),
    ('subject.delete', 'I', 'Delete subjects within the institution.'),
    ('subject.manage', 'I', 'Create, view, update, and delete subjects.'),

    ('term.create', 'I', 'Create study terms within the institution.'),
    ('term.view', 'I', 'View study terms and their periods.'),
    ('term.update', 'I', 'Update study terms and their periods.'),
    ('term.delete', 'I', 'Delete study terms within the institution.'),
    ('term.manage', 'I', 'Create, view, update, and delete study terms and their periods.'),

    ('offering.create', 'I', 'Create subject offerings within the institution.'),
    ('offering.view', 'IO', 'View offerings and their learning information.'),
    ('offering.update', 'IO', 'Update offerings within the assigned scope.'),
    ('offering.delete', 'IO', 'Delete offerings within the assigned scope.'),
    ('offering.manage', 'IO', 'View, update, and delete offerings within the assigned scope.'),

    ('role_request.review', 'I', 'Approve or reject requests to join the institution.'),
    ('role.create', 'I', 'Create roles within the institution.'),
    ('role.view', 'I', 'View role definitions, permissions, and inheritance.'),
    ('role.update', 'I', 'Update roles within the institution.'),
    ('role.delete', 'I', 'Delete roles within the institution.'),
    ('role.manage', 'I', 'Create, view, update, and delete institution roles.'),
    ('audit.view', 'I', 'View institution authorization and administration history.'),

    ('member.view', 'IO', 'View members and their roles within the assigned scope.'),
    ('role_assignment.manage', 'IO', 'Grant and revoke roles within the assigned scope.'),

    ('assessment.create', 'IO', 'Create assessments within the assigned scope.'),
    ('assessment.view', 'IO', 'View assessments and their configuration.'),
    ('assessment.update', 'IO', 'Update assessments within the assigned scope.'),
    ('assessment.delete', 'IO', 'Delete assessments within the assigned scope.'),
    ('assessment.manage', 'IO', 'Create, view, update, and delete assessments.'),
    ('assessment.attempt', 'IO', 'Start and submit assessment attempts.'),
    ('attempt.view_own', 'IO', 'View the current user''s own assessment attempts.'),
    ('attempt.view_all', 'IO', 'View assessment attempts belonging to other members in scope.'),
    ('tool.launch', 'IO', 'Launch tools allowed by an assessment.'),
    ('tool_session.replay_own', 'IO', 'Replay the current user''s own tool sessions.'),
    ('tool_session.replay_all', 'IO', 'Replay tool sessions belonging to other members in scope.')
ON CONFLICT ("permission")
DO UPDATE SET
    "type" = EXCLUDED."type",
    "description" = EXCLUDED."description";

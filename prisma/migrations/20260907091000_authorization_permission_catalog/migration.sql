-- Permission codes are application-owned reference data. Existing aggregate permissions remain
-- available for backwards compatibility while granular actions support least-privilege roles.
INSERT INTO "Permission" ("permission", "description")
VALUES
    ('institution.settings.view', 'View institution settings.'),
    ('institution.settings.update', 'Update institution settings.'),
    ('institution.settings.manage', 'View and update institution settings.'),

    ('subject.create', 'Create subjects within the institution.'),
    ('subject.view', 'View subjects within the institution.'),
    ('subject.update', 'Update subjects within the institution.'),
    ('subject.delete', 'Delete subjects within the institution.'),
    ('subject.manage', 'Create, view, update, and delete subjects.'),

    ('term.create', 'Create study terms within the institution.'),
    ('term.view', 'View study terms and their periods.'),
    ('term.update', 'Update study terms and their periods.'),
    ('term.delete', 'Delete study terms within the institution.'),
    ('term.manage', 'Create, view, update, and delete study terms and their periods.'),

    ('offering.create', 'Create subject offerings within the institution.'),
    ('offering.view', 'View offerings and their learning information.'),
    ('offering.update', 'Update offerings within the assigned scope.'),
    ('offering.delete', 'Delete offerings within the assigned scope.'),
    ('offering.manage', 'View, update, and delete offerings within the assigned scope.'),

    ('role_request.view', 'View role requests within the institution.'),
    ('role_request.approve', 'Approve role requests within the institution.'),
    ('role_request.reject', 'Reject role requests within the institution.'),
    ('role_request.review', 'View, approve, and reject role requests within the institution.'),
    ('scope_request.view', 'View offering-scope requests within the institution.'),
    ('scope_request.approve', 'Approve offering-scope requests within the institution.'),
    ('scope_request.reject', 'Reject offering-scope requests within the institution.'),
    ('scope_request.review', 'View, approve, and reject offering-scope requests.'),

    ('role.create', 'Create roles within the institution.'),
    ('role.view', 'View role definitions, permissions, and inheritance.'),
    ('role.update', 'Update roles within the institution.'),
    ('role.delete', 'Delete roles within the institution.'),
    ('role.manage', 'Create, view, update, and delete institution roles.'),
    ('audit.view', 'View institution authorization and administration history.'),
    ('member.view', 'View members and their roles within the assigned scope.'),

    ('role_assignment.view', 'View role assignments within the assigned scope.'),
    ('role_assignment.create', 'Grant roles within the assigned scope.'),
    ('role_assignment.revoke', 'Revoke role assignments within the assigned scope.'),
    ('role_assignment.manage', 'View, grant, and revoke roles within the assigned scope.'),
    ('scope_assignment.view', 'View offering scopes attached to role assignments.'),
    ('scope_assignment.create', 'Attach offering scopes to role assignments.'),
    ('scope_assignment.revoke', 'Remove offering scopes from role assignments.'),
    ('scope_assignment.manage', 'View, attach, and remove offering scopes.'),
    ('scope_assignment_code.view', 'View offering-scope assignment codes.'),
    ('scope_assignment_code.create', 'Create offering-scope assignment codes.'),
    ('scope_assignment_code.revoke', 'Revoke unused offering-scope assignment codes.'),
    ('scope_assignment_code.manage', 'View, create, and revoke offering-scope assignment codes.'),

    ('assessment.create', 'Create assessments within the assigned scope.'),
    ('assessment.view_published', 'View published assessments within the assigned scope.'),
    ('assessment.view', 'View assessments and their configuration.'),
    ('assessment.update', 'Update assessments within the assigned scope.'),
    ('assessment.delete', 'Delete assessments within the assigned scope.'),
    ('assessment.manage', 'Create, view, update, and delete assessments.'),
    ('assessment.attempt', 'Start and submit assessment attempts.'),
    ('attempt.view_own', 'View the current user''s own assessment attempts.'),
    ('attempt.view_all', 'View assessment attempts belonging to other members in scope.'),
    ('tool.launch', 'Launch tools allowed by an assessment.'),
    ('tool_session.replay_own', 'Replay the current user''s own tool sessions.'),
    ('tool_session.replay_all', 'Replay tool sessions belonging to other members in scope.')
ON CONFLICT ("permission")
DO UPDATE SET "description" = EXCLUDED."description";

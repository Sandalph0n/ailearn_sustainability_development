/**
 * Mã permission là giao kèo giữa authorization code và dữ liệu tham chiếu trong database.
 *
 * Chỉ dùng các hằng số này khi kiểm quyền. Chuỗi viết tay rải rác sẽ không được TypeScript
 * phát hiện khi một permission được đổi tên.
 */
export const PERMISSION_CODE = {
    INSTITUTION_SETTINGS_VIEW: 'institution.settings.view',
    INSTITUTION_SETTINGS_UPDATE: 'institution.settings.update',
    INSTITUTION_SETTINGS_MANAGE: 'institution.settings.manage',
    SUBJECT_CREATE: 'subject.create',
    SUBJECT_VIEW: 'subject.view',
    SUBJECT_UPDATE: 'subject.update',
    SUBJECT_DELETE: 'subject.delete',
    SUBJECT_MANAGE: 'subject.manage',
    TERM_CREATE: 'term.create',
    TERM_VIEW: 'term.view',
    TERM_UPDATE: 'term.update',
    TERM_DELETE: 'term.delete',
    TERM_MANAGE: 'term.manage',
    OFFERING_CREATE: 'offering.create',
    OFFERING_UPDATE: 'offering.update',
    OFFERING_DELETE: 'offering.delete',
    ROLE_REQUEST_VIEW: 'role_request.view',
    ROLE_REQUEST_APPROVE: 'role_request.approve',
    ROLE_REQUEST_REJECT: 'role_request.reject',
    ROLE_REQUEST_REVIEW: 'role_request.review',
    SCOPE_REQUEST_VIEW: 'scope_request.view',
    SCOPE_REQUEST_APPROVE: 'scope_request.approve',
    SCOPE_REQUEST_REJECT: 'scope_request.reject',
    SCOPE_REQUEST_REVIEW: 'scope_request.review',
    ROLE_CREATE: 'role.create',
    ROLE_VIEW: 'role.view',
    ROLE_UPDATE: 'role.update',
    ROLE_DELETE: 'role.delete',
    ROLE_MANAGE: 'role.manage',
    AUDIT_VIEW: 'audit.view',
    OFFERING_VIEW: 'offering.view',
    OFFERING_MANAGE: 'offering.manage',
    MEMBER_VIEW: 'member.view',
    ROLE_ASSIGNMENT_VIEW: 'role_assignment.view',
    ROLE_ASSIGNMENT_CREATE: 'role_assignment.create',
    ROLE_ASSIGNMENT_REVOKE: 'role_assignment.revoke',
    ROLE_ASSIGNMENT_MANAGE: 'role_assignment.manage',
    SCOPE_ASSIGNMENT_VIEW: 'scope_assignment.view',
    SCOPE_ASSIGNMENT_CREATE: 'scope_assignment.create',
    SCOPE_ASSIGNMENT_REVOKE: 'scope_assignment.revoke',
    SCOPE_ASSIGNMENT_MANAGE: 'scope_assignment.manage',
    SCOPE_ASSIGNMENT_CODE_VIEW: 'scope_assignment_code.view',
    SCOPE_ASSIGNMENT_CODE_CREATE: 'scope_assignment_code.create',
    SCOPE_ASSIGNMENT_CODE_REVOKE: 'scope_assignment_code.revoke',
    SCOPE_ASSIGNMENT_CODE_MANAGE: 'scope_assignment_code.manage',
    ASSESSMENT_CREATE: 'assessment.create',
    ASSESSMENT_VIEW_PUBLISHED: 'assessment.view_published',
    ASSESSMENT_VIEW: 'assessment.view',
    ASSESSMENT_UPDATE: 'assessment.update',
    ASSESSMENT_DELETE: 'assessment.delete',
    ASSESSMENT_MANAGE: 'assessment.manage',
    ASSESSMENT_ATTEMPT: 'assessment.attempt',
    ATTEMPT_VIEW_OWN: 'attempt.view_own',
    ATTEMPT_VIEW_ALL: 'attempt.view_all',
    ATTEMPT_MARK: 'attempt.mark',
    TOOL_LAUNCH: 'tool.launch',
    TOOL_SESSION_REPLAY_OWN: 'tool_session.replay_own',
    TOOL_SESSION_REPLAY_ALL: 'tool_session.replay_all',
} as const;

export type PermissionCode = (typeof PERMISSION_CODE)[keyof typeof PERMISSION_CODE];

/** Any one of these capabilities makes the Marking & Replay workspace useful. */
export const MARKING_REPLAY_PERMISSION_CODES = [
    PERMISSION_CODE.ASSESSMENT_VIEW,
    PERMISSION_CODE.ATTEMPT_VIEW_ALL,
    PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL,
    PERMISSION_CODE.ATTEMPT_MARK,
] as const satisfies readonly PermissionCode[];

export type PermissionRoleScope = 'INSTITUTION' | 'OFFERING';

/**
 * These actions target institution-owned resources that cannot be narrowed to one existing
 * offering. Offering-scoped roles may still use every other action, but authorization must
 * constrain it to the assignment's offering set.
 */
export const INSTITUTION_ONLY_PERMISSION_CODES = new Set<PermissionCode>([
    PERMISSION_CODE.INSTITUTION_SETTINGS_VIEW,
    PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE,
    PERMISSION_CODE.INSTITUTION_SETTINGS_MANAGE,
    PERMISSION_CODE.SUBJECT_CREATE,
    PERMISSION_CODE.SUBJECT_VIEW,
    PERMISSION_CODE.SUBJECT_UPDATE,
    PERMISSION_CODE.SUBJECT_DELETE,
    PERMISSION_CODE.SUBJECT_MANAGE,
    PERMISSION_CODE.TERM_CREATE,
    PERMISSION_CODE.TERM_VIEW,
    PERMISSION_CODE.TERM_UPDATE,
    PERMISSION_CODE.TERM_DELETE,
    PERMISSION_CODE.TERM_MANAGE,
    PERMISSION_CODE.OFFERING_CREATE,
    PERMISSION_CODE.ROLE_REQUEST_VIEW,
    PERMISSION_CODE.ROLE_REQUEST_APPROVE,
    PERMISSION_CODE.ROLE_REQUEST_REJECT,
    PERMISSION_CODE.ROLE_REQUEST_REVIEW,
    PERMISSION_CODE.ROLE_CREATE,
    PERMISSION_CODE.ROLE_VIEW,
    PERMISSION_CODE.ROLE_UPDATE,
    PERMISSION_CODE.ROLE_DELETE,
    PERMISSION_CODE.ROLE_MANAGE,
    PERMISSION_CODE.AUDIT_VIEW,
]);

export function permissionSupportsRoleScope(
    permission: string,
    scopeType: PermissionRoleScope,
): boolean {
    return (
        scopeType === 'INSTITUTION' ||
        !INSTITUTION_ONLY_PERMISSION_CODES.has(permission as PermissionCode)
    );
}

export type PermissionDefinition = Readonly<{
    description: string;
}>;

/**
 * Catalog đầy đủ của nền tảng.
 *
 * `satisfies Record<PermissionCode, ...>` khiến typecheck thất bại nếu một mã phía trên chưa có
 * metadata hoặc catalog chứa một mã không thuộc vocabulary.
 */
export const PERMISSION_CATALOG = {
    [PERMISSION_CODE.INSTITUTION_SETTINGS_VIEW]: {
        description: 'View institution settings.',
    },
    [PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE]: {
        description: 'Update institution settings.',
    },
    [PERMISSION_CODE.INSTITUTION_SETTINGS_MANAGE]: {
        description: 'View and update institution settings.',
    },
    [PERMISSION_CODE.SUBJECT_CREATE]: {
        description: 'Create subjects within the institution.',
    },
    [PERMISSION_CODE.SUBJECT_VIEW]: {
        description: 'View subjects within the institution.',
    },
    [PERMISSION_CODE.SUBJECT_UPDATE]: {
        description: 'Update subjects within the institution.',
    },
    [PERMISSION_CODE.SUBJECT_DELETE]: {
        description: 'Delete subjects within the institution.',
    },
    [PERMISSION_CODE.SUBJECT_MANAGE]: {
        description: 'Create, view, update, and delete subjects.',
    },
    [PERMISSION_CODE.TERM_CREATE]: {
        description: 'Create study terms within the institution.',
    },
    [PERMISSION_CODE.TERM_VIEW]: {
        description: 'View study terms and their periods.',
    },
    [PERMISSION_CODE.TERM_UPDATE]: {
        description: 'Update study terms and their periods.',
    },
    [PERMISSION_CODE.TERM_DELETE]: {
        description: 'Delete study terms within the institution.',
    },
    [PERMISSION_CODE.TERM_MANAGE]: {
        description: 'Create, view, update, and delete study terms and their periods.',
    },
    [PERMISSION_CODE.OFFERING_CREATE]: {
        description: 'Create subject offerings within the institution.',
    },
    [PERMISSION_CODE.ROLE_REQUEST_VIEW]: {
        description: 'View role requests within the institution.',
    },
    [PERMISSION_CODE.ROLE_REQUEST_APPROVE]: {
        description: 'Approve role requests within the institution.',
    },
    [PERMISSION_CODE.ROLE_REQUEST_REJECT]: {
        description: 'Reject role requests within the institution.',
    },
    [PERMISSION_CODE.ROLE_REQUEST_REVIEW]: {
        description: 'View, approve, and reject role requests within the institution.',
    },
    [PERMISSION_CODE.SCOPE_REQUEST_VIEW]: {
        description: 'View offering-scope requests within the institution.',
    },
    [PERMISSION_CODE.SCOPE_REQUEST_APPROVE]: {
        description: 'Approve offering-scope requests within the institution.',
    },
    [PERMISSION_CODE.SCOPE_REQUEST_REJECT]: {
        description: 'Reject offering-scope requests within the institution.',
    },
    [PERMISSION_CODE.SCOPE_REQUEST_REVIEW]: {
        description: 'View, approve, and reject offering-scope requests.',
    },
    [PERMISSION_CODE.ROLE_CREATE]: {
        description: 'Create roles within the institution.',
    },
    [PERMISSION_CODE.ROLE_VIEW]: {
        description: 'View role definitions, permissions, and inheritance.',
    },
    [PERMISSION_CODE.ROLE_UPDATE]: {
        description: 'Update roles within the institution.',
    },
    [PERMISSION_CODE.ROLE_DELETE]: {
        description: 'Delete roles within the institution.',
    },
    [PERMISSION_CODE.ROLE_MANAGE]: {
        description: 'Create, view, update, and delete institution roles.',
    },
    [PERMISSION_CODE.AUDIT_VIEW]: {
        description: 'View institution authorization and administration history.',
    },
    [PERMISSION_CODE.OFFERING_VIEW]: {
        description: 'View offerings and their learning information.',
    },
    [PERMISSION_CODE.OFFERING_UPDATE]: {
        description: 'Update offerings within the assigned scope.',
    },
    [PERMISSION_CODE.OFFERING_DELETE]: {
        description: 'Delete offerings within the assigned scope.',
    },
    [PERMISSION_CODE.OFFERING_MANAGE]: {
        description: 'View, update, and delete offerings within the assigned scope.',
    },
    [PERMISSION_CODE.MEMBER_VIEW]: {
        description: 'View members and their roles within the assigned scope.',
    },
    [PERMISSION_CODE.ROLE_ASSIGNMENT_VIEW]: {
        description: 'View role assignments within the assigned scope.',
    },
    [PERMISSION_CODE.ROLE_ASSIGNMENT_CREATE]: {
        description: 'Grant roles within the assigned scope.',
    },
    [PERMISSION_CODE.ROLE_ASSIGNMENT_REVOKE]: {
        description: 'Revoke role assignments within the assigned scope.',
    },
    [PERMISSION_CODE.ROLE_ASSIGNMENT_MANAGE]: {
        description: 'View, grant, and revoke roles within the assigned scope.',
    },
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_VIEW]: {
        description: 'View offering scopes attached to role assignments.',
    },
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_CREATE]: {
        description: 'Attach offering scopes to role assignments.',
    },
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_REVOKE]: {
        description: 'Remove offering scopes from role assignments.',
    },
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_MANAGE]: {
        description: 'View, attach, and remove offering scopes.',
    },
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_VIEW]: {
        description: 'View offering-scope assignment codes.',
    },
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_CREATE]: {
        description: 'Create offering-scope assignment codes.',
    },
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_REVOKE]: {
        description: 'Revoke unused offering-scope assignment codes.',
    },
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_MANAGE]: {
        description: 'View, create, and revoke offering-scope assignment codes.',
    },
    [PERMISSION_CODE.ASSESSMENT_CREATE]: {
        description: 'Create assessments within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_VIEW_PUBLISHED]: {
        description: 'View published assessments within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_VIEW]: {
        description: 'View assessments and their configuration.',
    },
    [PERMISSION_CODE.ASSESSMENT_UPDATE]: {
        description: 'Update assessments within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_DELETE]: {
        description: 'Delete assessments within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_MANAGE]: {
        description: 'Create, view, update, and delete assessments.',
    },
    [PERMISSION_CODE.ASSESSMENT_ATTEMPT]: {
        description: 'Start and submit assessment attempts.',
    },
    [PERMISSION_CODE.ATTEMPT_VIEW_OWN]: {
        description: "View the current user's own assessment attempts.",
    },
    [PERMISSION_CODE.ATTEMPT_VIEW_ALL]: {
        description: 'View assessment attempts belonging to other members in scope.',
    },
    [PERMISSION_CODE.ATTEMPT_MARK]: {
        description: 'Create, continue, and submit marks for assessment attempts in scope.',
    },
    [PERMISSION_CODE.TOOL_LAUNCH]: {
        description: 'Launch tools allowed by an assessment.',
    },
    [PERMISSION_CODE.TOOL_SESSION_REPLAY_OWN]: {
        description: "Replay the current user's own tool sessions.",
    },
    [PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL]: {
        description: 'Replay tool sessions belonging to other members in scope.',
    },
} as const satisfies Record<PermissionCode, PermissionDefinition>;

/**
 * `manage` là quyền tổng hợp, không phải một hành động CRUD thứ năm. Mỗi bundle khai chính xác
 * những hành động mà quyền tổng hợp bao hàm. Offering là ngoại lệ có chủ ý: tạo một offering mới
 * cần quyền `offering.create` cấp institution vì một resource chưa tồn tại thì chưa thể nằm trong
 * scope của role OFFERING.
 */
export const MANAGE_PERMISSION_BUNDLES = {
    [PERMISSION_CODE.INSTITUTION_SETTINGS_MANAGE]: [
        PERMISSION_CODE.INSTITUTION_SETTINGS_VIEW,
        PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE,
    ],
    [PERMISSION_CODE.SUBJECT_MANAGE]: [
        PERMISSION_CODE.SUBJECT_CREATE,
        PERMISSION_CODE.SUBJECT_VIEW,
        PERMISSION_CODE.SUBJECT_UPDATE,
        PERMISSION_CODE.SUBJECT_DELETE,
    ],
    [PERMISSION_CODE.TERM_MANAGE]: [
        PERMISSION_CODE.TERM_CREATE,
        PERMISSION_CODE.TERM_VIEW,
        PERMISSION_CODE.TERM_UPDATE,
        PERMISSION_CODE.TERM_DELETE,
    ],
    [PERMISSION_CODE.ROLE_MANAGE]: [
        PERMISSION_CODE.ROLE_CREATE,
        PERMISSION_CODE.ROLE_VIEW,
        PERMISSION_CODE.ROLE_UPDATE,
        PERMISSION_CODE.ROLE_DELETE,
    ],
    [PERMISSION_CODE.ROLE_REQUEST_REVIEW]: [
        PERMISSION_CODE.ROLE_REQUEST_VIEW,
        PERMISSION_CODE.ROLE_REQUEST_APPROVE,
        PERMISSION_CODE.ROLE_REQUEST_REJECT,
    ],
    [PERMISSION_CODE.SCOPE_REQUEST_REVIEW]: [
        PERMISSION_CODE.SCOPE_REQUEST_VIEW,
        PERMISSION_CODE.SCOPE_REQUEST_APPROVE,
        PERMISSION_CODE.SCOPE_REQUEST_REJECT,
    ],
    [PERMISSION_CODE.ROLE_ASSIGNMENT_MANAGE]: [
        PERMISSION_CODE.ROLE_ASSIGNMENT_VIEW,
        PERMISSION_CODE.ROLE_ASSIGNMENT_CREATE,
        PERMISSION_CODE.ROLE_ASSIGNMENT_REVOKE,
    ],
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_MANAGE]: [
        PERMISSION_CODE.SCOPE_ASSIGNMENT_VIEW,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CREATE,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_REVOKE,
    ],
    [PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_MANAGE]: [
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_VIEW,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_CREATE,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_REVOKE,
    ],
    [PERMISSION_CODE.OFFERING_MANAGE]: [
        PERMISSION_CODE.OFFERING_VIEW,
        PERMISSION_CODE.OFFERING_UPDATE,
        PERMISSION_CODE.OFFERING_DELETE,
    ],
    [PERMISSION_CODE.ASSESSMENT_MANAGE]: [
        PERMISSION_CODE.ASSESSMENT_CREATE,
        PERMISSION_CODE.ASSESSMENT_VIEW,
        PERMISSION_CODE.ASSESSMENT_UPDATE,
        PERMISSION_CODE.ASSESSMENT_DELETE,
    ],
} as const satisfies Partial<Record<PermissionCode, readonly PermissionCode[]>>;

/** Các implication một chiều không phải bundle tổng hợp. */
export const PERMISSION_IMPLICATIONS = {
    [PERMISSION_CODE.ASSESSMENT_VIEW]: [PERMISSION_CODE.ASSESSMENT_VIEW_PUBLISHED],
} as const satisfies Partial<Record<PermissionCode, readonly PermissionCode[]>>;

export type ManagePermissionCode = keyof typeof MANAGE_PERMISSION_BUNDLES;

function isManagePermissionCode(permission: PermissionCode): permission is ManagePermissionCode {
    return permission in MANAGE_PERMISSION_BUNDLES;
}

/**
 * Kiểm một action sau khi đã áp dụng implication của quyền `manage`.
 *
 * Chiều ngược cũng có nghĩa: nếu role được cấp đủ mọi action riêng lẻ thì yêu cầu `*.manage`
 * được thoả mãn. Nhờ vậy API không phụ thuộc role editor đã lưu bundle hay bốn quyền thành phần.
 */
export function hasPermission(
    grantedPermissions: Iterable<PermissionCode>,
    requestedPermission: PermissionCode,
): boolean {
    const granted = new Set(grantedPermissions);
    const effective = new Set(granted);
    const queue = [...granted];

    for (let index = 0; index < queue.length; index += 1) {
        const permission = queue[index];
        const implied = [
            ...(MANAGE_PERMISSION_BUNDLES[permission as ManagePermissionCode] ?? []),
            ...(PERMISSION_IMPLICATIONS[
                permission as keyof typeof PERMISSION_IMPLICATIONS
            ] ?? []),
        ];

        for (const impliedPermission of implied) {
            if (effective.has(impliedPermission)) continue;
            effective.add(impliedPermission);
            queue.push(impliedPermission);
        }
    }

    if (effective.has(requestedPermission)) return true;

    if (
        isManagePermissionCode(requestedPermission) &&
        MANAGE_PERMISSION_BUNDLES[requestedPermission].every((permission) =>
            effective.has(permission),
        )
    ) {
        return true;
    }

    return Object.entries(MANAGE_PERMISSION_BUNDLES).some(
        ([managePermission, actions]) =>
            effective.has(managePermission as ManagePermissionCode) &&
            (actions as readonly PermissionCode[]).includes(requestedPermission),
    );
}

export function hasEveryPermission(
    grantedPermissions: Iterable<PermissionCode>,
    requestedPermissions: readonly PermissionCode[],
): boolean {
    const granted = [...grantedPermissions];
    return requestedPermissions.every((permission) => hasPermission(granted, permission));
}

export function hasAnyPermission(
    grantedPermissions: Iterable<PermissionCode>,
    requestedPermissions: readonly PermissionCode[],
): boolean {
    const granted = [...grantedPermissions];
    return requestedPermissions.some((permission) => hasPermission(granted, permission));
}

export const ALL_PERMISSION_CODES = Object.freeze(
    Object.values(PERMISSION_CODE),
) as readonly PermissionCode[];

const permissionCodeSet: ReadonlySet<string> = new Set(ALL_PERMISSION_CODES);

/** Thu hẹp chuỗi từ request/database về union `PermissionCode` an toàn. */
export function isPermissionCode(value: unknown): value is PermissionCode {
    return typeof value === 'string' && permissionCodeSet.has(value);
}

/** Dừng sớm tại boundary nếu nhận một mã không thuộc vocabulary của ứng dụng. */
export function assertPermissionCode(value: string): asserts value is PermissionCode {
    if (!isPermissionCode(value)) {
        throw new TypeError(`Unknown permission code: ${value}`);
    }
}

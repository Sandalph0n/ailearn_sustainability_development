import { PermissionType, RoleScopeType } from '../../app/generated/prisma/enums';

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
    ROLE_REQUEST_REVIEW: 'role_request.review',
    ROLE_CREATE: 'role.create',
    ROLE_VIEW: 'role.view',
    ROLE_UPDATE: 'role.update',
    ROLE_DELETE: 'role.delete',
    ROLE_MANAGE: 'role.manage',
    AUDIT_VIEW: 'audit.view',
    OFFERING_VIEW: 'offering.view',
    OFFERING_MANAGE: 'offering.manage',
    MEMBER_VIEW: 'member.view',
    ROLE_ASSIGNMENT_MANAGE: 'role_assignment.manage',
    ASSESSMENT_CREATE: 'assessment.create',
    ASSESSMENT_VIEW: 'assessment.view',
    ASSESSMENT_UPDATE: 'assessment.update',
    ASSESSMENT_DELETE: 'assessment.delete',
    ASSESSMENT_MANAGE: 'assessment.manage',
    ASSESSMENT_ATTEMPT: 'assessment.attempt',
    ATTEMPT_VIEW_OWN: 'attempt.view_own',
    ATTEMPT_VIEW_ALL: 'attempt.view_all',
    TOOL_LAUNCH: 'tool.launch',
    TOOL_SESSION_REPLAY_OWN: 'tool_session.replay_own',
    TOOL_SESSION_REPLAY_ALL: 'tool_session.replay_all',
} as const;

export type PermissionCode = (typeof PERMISSION_CODE)[keyof typeof PERMISSION_CODE];

export type PermissionDefinition = Readonly<{
    type: PermissionType;
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
        type: PermissionType.I,
        description: 'View institution settings.',
    },
    [PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE]: {
        type: PermissionType.I,
        description: 'Update institution settings.',
    },
    [PERMISSION_CODE.INSTITUTION_SETTINGS_MANAGE]: {
        type: PermissionType.I,
        description: 'View and update institution settings.',
    },
    [PERMISSION_CODE.SUBJECT_CREATE]: {
        type: PermissionType.I,
        description: 'Create subjects within the institution.',
    },
    [PERMISSION_CODE.SUBJECT_VIEW]: {
        type: PermissionType.I,
        description: 'View subjects within the institution.',
    },
    [PERMISSION_CODE.SUBJECT_UPDATE]: {
        type: PermissionType.I,
        description: 'Update subjects within the institution.',
    },
    [PERMISSION_CODE.SUBJECT_DELETE]: {
        type: PermissionType.I,
        description: 'Delete subjects within the institution.',
    },
    [PERMISSION_CODE.SUBJECT_MANAGE]: {
        type: PermissionType.I,
        description: 'Create, view, update, and delete subjects.',
    },
    [PERMISSION_CODE.TERM_CREATE]: {
        type: PermissionType.I,
        description: 'Create study terms within the institution.',
    },
    [PERMISSION_CODE.TERM_VIEW]: {
        type: PermissionType.I,
        description: 'View study terms and their periods.',
    },
    [PERMISSION_CODE.TERM_UPDATE]: {
        type: PermissionType.I,
        description: 'Update study terms and their periods.',
    },
    [PERMISSION_CODE.TERM_DELETE]: {
        type: PermissionType.I,
        description: 'Delete study terms within the institution.',
    },
    [PERMISSION_CODE.TERM_MANAGE]: {
        type: PermissionType.I,
        description: 'Create, view, update, and delete study terms and their periods.',
    },
    [PERMISSION_CODE.OFFERING_CREATE]: {
        type: PermissionType.I,
        description: 'Create subject offerings within the institution.',
    },
    [PERMISSION_CODE.ROLE_REQUEST_REVIEW]: {
        type: PermissionType.I,
        description: 'Approve or reject requests to join the institution.',
    },
    [PERMISSION_CODE.ROLE_CREATE]: {
        type: PermissionType.I,
        description: 'Create roles within the institution.',
    },
    [PERMISSION_CODE.ROLE_VIEW]: {
        type: PermissionType.I,
        description: 'View role definitions, permissions, and inheritance.',
    },
    [PERMISSION_CODE.ROLE_UPDATE]: {
        type: PermissionType.I,
        description: 'Update roles within the institution.',
    },
    [PERMISSION_CODE.ROLE_DELETE]: {
        type: PermissionType.I,
        description: 'Delete roles within the institution.',
    },
    [PERMISSION_CODE.ROLE_MANAGE]: {
        type: PermissionType.I,
        description: 'Create, view, update, and delete institution roles.',
    },
    [PERMISSION_CODE.AUDIT_VIEW]: {
        type: PermissionType.I,
        description: 'View institution authorization and administration history.',
    },
    [PERMISSION_CODE.OFFERING_VIEW]: {
        type: PermissionType.IO,
        description: 'View offerings and their learning information.',
    },
    [PERMISSION_CODE.OFFERING_UPDATE]: {
        type: PermissionType.IO,
        description: 'Update offerings within the assigned scope.',
    },
    [PERMISSION_CODE.OFFERING_DELETE]: {
        type: PermissionType.IO,
        description: 'Delete offerings within the assigned scope.',
    },
    [PERMISSION_CODE.OFFERING_MANAGE]: {
        type: PermissionType.IO,
        description: 'View, update, and delete offerings within the assigned scope.',
    },
    [PERMISSION_CODE.MEMBER_VIEW]: {
        type: PermissionType.IO,
        description: 'View members and their roles within the assigned scope.',
    },
    [PERMISSION_CODE.ROLE_ASSIGNMENT_MANAGE]: {
        type: PermissionType.IO,
        description: 'Grant and revoke roles within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_CREATE]: {
        type: PermissionType.IO,
        description: 'Create assessments within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_VIEW]: {
        type: PermissionType.IO,
        description: 'View assessments and their configuration.',
    },
    [PERMISSION_CODE.ASSESSMENT_UPDATE]: {
        type: PermissionType.IO,
        description: 'Update assessments within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_DELETE]: {
        type: PermissionType.IO,
        description: 'Delete assessments within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_MANAGE]: {
        type: PermissionType.IO,
        description: 'Create, view, update, and delete assessments.',
    },
    [PERMISSION_CODE.ASSESSMENT_ATTEMPT]: {
        type: PermissionType.IO,
        description: 'Start and submit assessment attempts.',
    },
    [PERMISSION_CODE.ATTEMPT_VIEW_OWN]: {
        type: PermissionType.IO,
        description: "View the current user's own assessment attempts.",
    },
    [PERMISSION_CODE.ATTEMPT_VIEW_ALL]: {
        type: PermissionType.IO,
        description: 'View assessment attempts belonging to other members in scope.',
    },
    [PERMISSION_CODE.TOOL_LAUNCH]: {
        type: PermissionType.IO,
        description: 'Launch tools allowed by an assessment.',
    },
    [PERMISSION_CODE.TOOL_SESSION_REPLAY_OWN]: {
        type: PermissionType.IO,
        description: "Replay the current user's own tool sessions.",
    },
    [PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL]: {
        type: PermissionType.IO,
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
    if (granted.has(requestedPermission)) return true;

    if (
        isManagePermissionCode(requestedPermission) &&
        MANAGE_PERMISSION_BUNDLES[requestedPermission].every((permission) =>
            granted.has(permission),
        )
    ) {
        return true;
    }

    return Object.entries(MANAGE_PERMISSION_BUNDLES).some(
        ([managePermission, actions]) =>
            granted.has(managePermission as ManagePermissionCode) &&
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

/**
 * Role cấp Institution dùng được cả permission `I` lẫn `IO`; Role cấp Offering chỉ dùng `IO`.
 * Switch exhaustive làm typecheck thất bại nếu Prisma có thêm một RoleScopeType mới.
 */
export function canRoleScopeUsePermission(
    roleScope: RoleScopeType,
    permission: PermissionCode,
): boolean {
    switch (roleScope) {
        case RoleScopeType.INSTITUTION:
            return true;
        case RoleScopeType.OFFERING:
            return PERMISSION_CATALOG[permission].type === PermissionType.IO;
        default:
            return assertNever(roleScope);
    }
}

function assertNever(value: never): never {
    throw new TypeError(`Unsupported role scope: ${String(value)}`);
}

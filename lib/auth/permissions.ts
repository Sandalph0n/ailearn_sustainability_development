import { PermissionType, RoleScopeType } from '../../app/generated/prisma/enums';

/**
 * Mã permission là giao kèo giữa authorization code và dữ liệu tham chiếu trong database.
 *
 * Chỉ dùng các hằng số này khi kiểm quyền. Chuỗi viết tay rải rác sẽ không được TypeScript
 * phát hiện khi một permission được đổi tên.
 */
export const PERMISSION_CODE = {
    INSTITUTION_SETTINGS_MANAGE: 'institution.settings.manage',
    SUBJECT_MANAGE: 'subject.manage',
    TERM_MANAGE: 'term.manage',
    OFFERING_CREATE: 'offering.create',
    ROLE_REQUEST_REVIEW: 'role_request.review',
    ROLE_VIEW: 'role.view',
    ROLE_MANAGE: 'role.manage',
    AUDIT_VIEW: 'audit.view',
    OFFERING_VIEW: 'offering.view',
    OFFERING_MANAGE: 'offering.manage',
    MEMBER_VIEW: 'member.view',
    ROLE_ASSIGNMENT_MANAGE: 'role_assignment.manage',
    ASSESSMENT_VIEW: 'assessment.view',
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
    [PERMISSION_CODE.INSTITUTION_SETTINGS_MANAGE]: {
        type: PermissionType.I,
        description: 'Manage institution settings.',
    },
    [PERMISSION_CODE.SUBJECT_MANAGE]: {
        type: PermissionType.I,
        description: 'Create, update, and delete subjects.',
    },
    [PERMISSION_CODE.TERM_MANAGE]: {
        type: PermissionType.I,
        description: 'Manage study terms and their periods.',
    },
    [PERMISSION_CODE.OFFERING_CREATE]: {
        type: PermissionType.I,
        description: 'Create subject offerings within the institution.',
    },
    [PERMISSION_CODE.ROLE_REQUEST_REVIEW]: {
        type: PermissionType.I,
        description: 'Approve or reject requests to join the institution.',
    },
    [PERMISSION_CODE.ROLE_VIEW]: {
        type: PermissionType.I,
        description: 'View role definitions, permissions, and inheritance.',
    },
    [PERMISSION_CODE.ROLE_MANAGE]: {
        type: PermissionType.I,
        description: 'Create, update, and delete institution roles.',
    },
    [PERMISSION_CODE.AUDIT_VIEW]: {
        type: PermissionType.I,
        description: 'View institution authorization and administration history.',
    },
    [PERMISSION_CODE.OFFERING_VIEW]: {
        type: PermissionType.IO,
        description: 'View offerings and their learning information.',
    },
    [PERMISSION_CODE.OFFERING_MANAGE]: {
        type: PermissionType.IO,
        description: 'Update or delete offerings within the assigned scope.',
    },
    [PERMISSION_CODE.MEMBER_VIEW]: {
        type: PermissionType.IO,
        description: 'View members and their roles within the assigned scope.',
    },
    [PERMISSION_CODE.ROLE_ASSIGNMENT_MANAGE]: {
        type: PermissionType.IO,
        description: 'Grant and revoke roles within the assigned scope.',
    },
    [PERMISSION_CODE.ASSESSMENT_VIEW]: {
        type: PermissionType.IO,
        description: 'View assessments and their configuration.',
    },
    [PERMISSION_CODE.ASSESSMENT_MANAGE]: {
        type: PermissionType.IO,
        description: 'Create, update, and delete assessments.',
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

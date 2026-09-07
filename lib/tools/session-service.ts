import 'server-only';

import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import {
    hasPermission,
    PERMISSION_CODE,
    type PermissionCode,
} from '@/lib/auth/permissions';
import {
    accessCoversOffering,
    learningAccessForSelector,
    type LearningAccess,
} from '@/components/navigation/learning/policy';
import { db } from '@/lib/db';
import type { ToolCapability, ToolSessionResponse } from '@/lib/tools/api-contract';
import {
    signToolToken,
    TOOL_TOKEN_TTL_SECONDS,
    type ToolTokenContext,
} from '@/lib/tools/token';
import type { ToolClaims } from '@/lib/tools/api-auth';
import type { ErrorCode } from '@/lib/auth/http/response';
import { buildToolRuntimeUrl } from '@/lib/tools/runtime-url';

export class ToolSessionError extends Error {
    constructor(
        readonly status: number,
        readonly code: ErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'ToolSessionError';
    }
}

type AuthorizedRuntime = {
    tokenContext: ToolTokenContext;
    toolCode: string;
    entryPath: string;
};

async function assignmentAccess(
    userId: string,
    roleAssignmentId: string,
    institutionId: string,
    offeringId: string,
): Promise<LearningAccess | null> {
    const contexts = (await listAuthorizedContextOptions(userId)).filter(
        (context) => context.assignmentId === roleAssignmentId,
    );
    const selected = contexts[0];
    if (!selected || selected.institution.id !== institutionId) return null;

    const access = learningAccessForSelector(contexts, {
        institutionId,
        roleId: selected.role.id,
    });
    return access && accessCoversOffering(access, offeringId) ? access : null;
}

function has(access: LearningAccess, permission: PermissionCode): boolean {
    return hasPermission(access.permissions, permission);
}

function ownerCapabilities(access: LearningAccess, readOnly: boolean): ToolCapability[] {
    const capabilities: ToolCapability[] = ['files:read'];
    if (!readOnly) capabilities.push('files:write', 'events:append');
    if (
        has(access, PERMISSION_CODE.TOOL_SESSION_REPLAY_OWN) ||
        has(access, PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL)
    ) {
        capabilities.push('replay:read');
    }
    return capabilities;
}

function replayAllowed(access: LearningAccess, ownsAttempt: boolean): boolean {
    if (ownsAttempt) {
        return (
            has(access, PERMISSION_CODE.TOOL_SESSION_REPLAY_OWN) ||
            has(access, PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL)
        );
    }
    return (
        has(access, PERMISSION_CODE.ATTEMPT_VIEW_ALL) &&
        has(access, PERMISSION_CODE.TOOL_SESSION_REPLAY_ALL)
    );
}

async function issue(runtime: AuthorizedRuntime): Promise<ToolSessionResponse> {
    const token = await signToolToken(runtime.tokenContext);
    return {
        token,
        tokenType: 'Bearer',
        expiresIn: TOOL_TOKEN_TTL_SECONDS,
        runtimeUrl: buildToolRuntimeUrl(
            runtime.toolCode,
            runtime.tokenContext.toolVersionId,
            runtime.entryPath,
            token,
        ),
        session: {
            id: runtime.tokenContext.workSessionId,
            mode: runtime.tokenContext.mode,
            readOnly: runtime.tokenContext.readOnly,
            capabilities: [...runtime.tokenContext.capabilities],
        },
    };
}

export async function startToolWorkSession(input: {
    userId: string;
    loginSessionId: string;
    attemptId: string;
    toolId: string;
    roleAssignmentId: string;
}): Promise<{ response: ToolSessionResponse; toolCode: string; toolVersionId: string }> {
    const attempt = await db.assessmentAttempt.findUnique({
        where: { id: input.attemptId },
        select: {
            userId: true,
            submitAt: true,
            workspace: { select: { workspaceId: true } },
            assessment: {
                select: {
                    offeringId: true,
                    offering: {
                        select: { subject: { select: { institutionId: true } } },
                    },
                    allowedTools: {
                        where: { toolId: input.toolId },
                        select: {
                            tool: {
                                select: {
                                    id: true,
                                    code: true,
                                    activeVersion: {
                                        select: { id: true, version: true, entryPath: true },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!attempt || attempt.userId !== input.userId || !attempt.workspace) {
        throw new ToolSessionError(404, 'NOT_FOUND', 'Assessment attempt not found');
    }

    const access = await assignmentAccess(
        input.userId,
        input.roleAssignmentId,
        attempt.assessment.offering.subject.institutionId,
        attempt.assessment.offeringId,
    );
    if (!access || !has(access, PERMISSION_CODE.TOOL_LAUNCH)) {
        throw new ToolSessionError(403, 'AUTHORIZATION_FORBIDDEN', 'This role cannot launch tools for the offering');
    }

    const allowedTool = attempt.assessment.allowedTools[0]?.tool;
    if (!allowedTool) {
        throw new ToolSessionError(403, 'AUTHORIZATION_FORBIDDEN', 'This tool is not allowed for the assessment');
    }
    if (!allowedTool.activeVersion) {
        throw new ToolSessionError(409, 'RESOURCE_IN_USE', 'The tool has no active version');
    }

    const workSession = await db.assignmentWorkSession.create({
        data: {
            assignmentWorkspaceId: attempt.workspace.workspaceId,
            toolId: allowedTool.id,
            toolVersionId: allowedTool.activeVersion.id,
        },
        select: { id: true },
    });
    const readOnly = attempt.submitAt !== null;
    const runtime: AuthorizedRuntime = {
        toolCode: allowedTool.code,
        entryPath: allowedTool.activeVersion.entryPath,
        tokenContext: {
            userId: input.userId,
            toolId: allowedTool.id,
            toolVersionId: allowedTool.activeVersion.id,
            workSessionId: workSession.id,
            assignmentWorkspaceId: attempt.workspace.workspaceId,
            roleAssignmentId: input.roleAssignmentId,
            loginSessionId: input.loginSessionId,
            mode: 'OWNER',
            readOnly,
            capabilities: ownerCapabilities(access, readOnly),
        },
    };

    return {
        response: await issue(runtime),
        toolCode: runtime.toolCode,
        toolVersionId: runtime.tokenContext.toolVersionId,
    };
}

async function authorizeReplay(input: {
    userId: string;
    loginSessionId: string;
    workSessionId: string;
    roleAssignmentId: string;
}): Promise<AuthorizedRuntime> {
    const workSession = await db.assignmentWorkSession.findUnique({
        where: { id: input.workSessionId },
        select: {
            id: true,
            assignmentWorkspaceId: true,
            toolId: true,
            tool: { select: { code: true } },
            toolVersion: { select: { id: true, version: true, entryPath: true } },
            workspace: {
                select: {
                    attempt: {
                        select: {
                            userId: true,
                            assessment: {
                                select: {
                                    offeringId: true,
                                    offering: {
                                        select: { subject: { select: { institutionId: true } } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!workSession) throw new ToolSessionError(404, 'NOT_FOUND', 'Tool work session not found');
    if (!workSession.toolVersion) {
        throw new ToolSessionError(409, 'RESOURCE_IN_USE', 'This legacy session has no pinned tool version');
    }

    const access = await assignmentAccess(
        input.userId,
        input.roleAssignmentId,
        workSession.workspace.attempt.assessment.offering.subject.institutionId,
        workSession.workspace.attempt.assessment.offeringId,
    );
    const ownsAttempt = workSession.workspace.attempt.userId === input.userId;
    if (!access || !replayAllowed(access, ownsAttempt)) {
        throw new ToolSessionError(403, 'AUTHORIZATION_FORBIDDEN', 'This role cannot replay the selected session');
    }

    return {
        toolCode: workSession.tool.code,
        entryPath: workSession.toolVersion.entryPath,
        tokenContext: {
            userId: input.userId,
            toolId: workSession.toolId,
            toolVersionId: workSession.toolVersion.id,
            workSessionId: workSession.id,
            assignmentWorkspaceId: workSession.assignmentWorkspaceId,
            roleAssignmentId: input.roleAssignmentId,
            loginSessionId: input.loginSessionId,
            mode: 'REVIEWER',
            readOnly: true,
            capabilities: ['files:read', 'replay:read'],
        },
    };
}

export async function startToolReplaySession(input: {
    userId: string;
    loginSessionId: string;
    workSessionId: string;
    roleAssignmentId: string;
}): Promise<{ response: ToolSessionResponse; toolCode: string; toolVersionId: string }> {
    const runtime = await authorizeReplay(input);
    return {
        response: await issue(runtime),
        toolCode: runtime.toolCode,
        toolVersionId: runtime.tokenContext.toolVersionId,
    };
}

export async function refreshToolSession(claims: ToolClaims): Promise<{
    response: ToolSessionResponse;
    toolCode: string;
    toolVersionId: string;
}> {
    const loginSession = await db.loginSession.findFirst({
        where: {
            id: claims.loginSessionId,
            userId: claims.sub,
            expiresAt: { gt: new Date() },
        },
        select: { id: true },
    });
    if (!loginSession) {
        throw new ToolSessionError(401, 'AUTHENTICATION_REQUIRED', 'The platform session is no longer active');
    }

    if (claims.mode === 'REVIEWER') {
        return startToolReplaySession({
            userId: claims.sub,
            loginSessionId: claims.loginSessionId,
            workSessionId: claims.workSessionId,
            roleAssignmentId: claims.roleAssignmentId,
        });
    }

    const workSession = await db.assignmentWorkSession.findUnique({
        where: { id: claims.workSessionId },
        select: {
            id: true,
            endAt: true,
            assignmentWorkspaceId: true,
            toolId: true,
            tool: { select: { code: true } },
            toolVersion: { select: { id: true, version: true, entryPath: true } },
            workspace: {
                select: {
                    attempt: {
                        select: {
                            userId: true,
                            submitAt: true,
                            assessment: {
                                select: {
                                    offeringId: true,
                                    offering: {
                                        select: { subject: { select: { institutionId: true } } },
                                    },
                                    allowedTools: {
                                        where: { toolId: claims.toolId },
                                        select: { toolId: true },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (
        !workSession ||
        workSession.endAt ||
        workSession.assignmentWorkspaceId !== claims.assignmentWorkspaceId ||
        workSession.toolId !== claims.toolId ||
        workSession.toolVersion?.id !== claims.toolVersionId ||
        workSession.workspace.attempt.userId !== claims.sub ||
        workSession.workspace.attempt.assessment.allowedTools.length === 0
    ) {
        throw new ToolSessionError(401, 'AUTHENTICATION_REQUIRED', 'The tool session can no longer be refreshed');
    }

    const access = await assignmentAccess(
        claims.sub,
        claims.roleAssignmentId,
        workSession.workspace.attempt.assessment.offering.subject.institutionId,
        workSession.workspace.attempt.assessment.offeringId,
    );
    if (!access || !has(access, PERMISSION_CODE.TOOL_LAUNCH) || !workSession.toolVersion) {
        throw new ToolSessionError(403, 'AUTHORIZATION_FORBIDDEN', 'Tool access has been revoked');
    }

    const readOnly = workSession.workspace.attempt.submitAt !== null;
    const runtime: AuthorizedRuntime = {
        toolCode: workSession.tool.code,
        entryPath: workSession.toolVersion.entryPath,
        tokenContext: {
            userId: claims.sub,
            toolId: claims.toolId,
            toolVersionId: claims.toolVersionId,
            workSessionId: claims.workSessionId,
            assignmentWorkspaceId: claims.assignmentWorkspaceId,
            roleAssignmentId: claims.roleAssignmentId,
            loginSessionId: claims.loginSessionId,
            mode: 'OWNER',
            readOnly,
            capabilities: ownerCapabilities(access, readOnly),
        },
    };

    return {
        response: await issue(runtime),
        toolCode: runtime.toolCode,
        toolVersionId: runtime.tokenContext.toolVersionId,
    };
}

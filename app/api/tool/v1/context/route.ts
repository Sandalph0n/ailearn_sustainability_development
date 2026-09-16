import { NextRequest, NextResponse } from 'next/server';

import { pictureUrl } from '@/components/media/picture-url';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { guardToolApi } from '@/lib/tools/api-auth';
import { platformOrigin } from '@/lib/tools/platform-origin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolApi(request);
    if (!guard.ok) return guard.response;
    const claims = guard.claims;

    const [viewer, roleAssignment, runtimeVersion] = await Promise.all([
        db.user.findUnique({
            where: { id: claims.sub },
            select: { id: true, firstName: true, lastName: true, avatarKey: true },
        }),
        db.roleAssignment.findFirst({
            where: {
                id: claims.roleAssignmentId,
                userId: claims.sub,
                roleRevokedAt: null,
            },
            select: {
                id: true,
                role: {
                    select: {
                        id: true,
                        roleCode: true,
                        roleName: true,
                        scopeType: true,
                        institution: { select: { id: true, name: true } },
                    },
                },
            },
        }),
        db.toolVersion.findFirst({
            where: { id: claims.toolVersionId, toolId: claims.toolId },
            select: {
                id: true,
                version: true,
                entryPath: true,
                tool: { select: { id: true, code: true, name: true, description: true } },
            },
        }),
    ]);

    if (!viewer || !roleAssignment || !runtimeVersion) {
        return errorResponse(404, 'NOT_FOUND', 'Tool session context no longer exists');
    }

    const shared = {
        apiVersion: 'v1' as const,
        platform: {
            dashboardUrl: new URL('/navigation/dashboard', platformOrigin()).toString(),
        },
        user: {
            id: viewer.id,
            displayName: `${viewer.firstName} ${viewer.lastName}`.trim(),
            avatarUrl: pictureUrl(viewer.avatarKey) ?? null,
        },
        role: {
            id: roleAssignment.role.id,
            roleCode: roleAssignment.role.roleCode,
            roleName: roleAssignment.role.roleName,
            scopeType: roleAssignment.role.scopeType,
        },
        tool: {
            ...runtimeVersion.tool,
            version: {
                id: runtimeVersion.id,
                version: runtimeVersion.version,
                entry: runtimeVersion.entryPath,
            },
        },
    };

    if (claims.workspaceKind === 'PERSONAL') {
        const workspace = await db.workspace.findFirst({
            where: {
                id: claims.assignmentWorkspaceId,
                personal: { userId: claims.sub },
            },
            select: { id: true, name: true, createdAt: true, lastOpenedAt: true },
        });
        if (!workspace) {
            return errorResponse(404, 'NOT_FOUND', 'Personal workspace no longer exists');
        }

        const startedAt = claims.sessionStartedAt;
        return jsonResponse({
            ...shared,
            session: {
                id: claims.workSessionId,
                mode: claims.mode,
                readOnly: claims.readOnly,
                capabilities: claims.capabilities,
                startedAt,
                endedAt: null,
            },
            workspace: {
                ...workspace,
                createdAt: workspace.createdAt.toISOString(),
                lastOpenedAt: workspace.lastOpenedAt?.toISOString() ?? null,
            },
            // Keep the v1 context shape stable for existing tool builds. Personal sessions are
            // unmistakably labelled and never receive event or replay capabilities.
            attempt: {
                id: workspace.id,
                startedAt,
                submittedAt: null,
                owner: shared.user,
            },
            assessment: {
                id: workspace.id,
                name: workspace.name,
                description: 'Personal workspace',
                weight: 0,
                hurdle: false,
                isGroup: false,
                publishAt: null,
                dueAt: null,
                expectedDue: null,
            },
            offering: {
                id: workspace.id,
                institution: roleAssignment.role.institution,
                subject: { code: 'PERSONAL', name: 'Personal workspace' },
                term: {
                    id: workspace.id,
                    year: new Date().getUTCFullYear(),
                    session: 0,
                },
            },
        });
    }

    const workSession = await db.assignmentWorkSession.findFirst({
        where: {
            id: claims.workSessionId,
            assignmentWorkspaceId: claims.assignmentWorkspaceId,
            toolId: claims.toolId,
            toolVersionId: claims.toolVersionId,
        },
        select: {
            id: true,
            startAt: true,
            endAt: true,
            workspace: {
                select: {
                    workspace: {
                        select: { id: true, name: true, createdAt: true, lastOpenedAt: true },
                    },
                    attempt: {
                        select: {
                            id: true,
                            startAt: true,
                            submitAt: true,
                            user: {
                                select: { id: true, firstName: true, lastName: true, avatarKey: true },
                            },
                            assessment: {
                                select: {
                                    id: true,
                                    name: true,
                                    description: true,
                                    weight: true,
                                    hurdle: true,
                                    isGroup: true,
                                    publishAt: true,
                                    dueAt: true,
                                    expectedDue: true,
                                    offering: {
                                        select: {
                                            id: true,
                                            subject: {
                                                select: {
                                                    subjectCode: true,
                                                    subjectName: true,
                                                    institution: { select: { id: true, name: true } },
                                                },
                                            },
                                            term: { select: { id: true, year: true, session: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!workSession) {
        return errorResponse(404, 'NOT_FOUND', 'Recorded tool session no longer exists');
    }

    const attempt = workSession.workspace.attempt;
    const assessment = attempt.assessment;
    const offering = assessment.offering;
    return jsonResponse({
        ...shared,
        session: {
            id: workSession.id,
            mode: claims.mode,
            readOnly: claims.readOnly,
            capabilities: claims.capabilities,
            startedAt: workSession.startAt.toISOString(),
            endedAt: workSession.endAt?.toISOString() ?? null,
        },
        workspace: {
            ...workSession.workspace.workspace,
            createdAt: workSession.workspace.workspace.createdAt.toISOString(),
            lastOpenedAt: workSession.workspace.workspace.lastOpenedAt?.toISOString() ?? null,
        },
        attempt: {
            id: attempt.id,
            startedAt: attempt.startAt.toISOString(),
            submittedAt: attempt.submitAt?.toISOString() ?? null,
            owner: {
                id: attempt.user.id,
                displayName: `${attempt.user.firstName} ${attempt.user.lastName}`.trim(),
                avatarUrl: pictureUrl(attempt.user.avatarKey) ?? null,
            },
        },
        assessment: {
            id: assessment.id,
            name: assessment.name,
            description: assessment.description,
            weight: assessment.weight,
            hurdle: assessment.hurdle,
            isGroup: assessment.isGroup,
            publishAt: assessment.publishAt?.toISOString() ?? null,
            dueAt: assessment.dueAt?.toISOString() ?? null,
            expectedDue: assessment.expectedDue,
        },
        offering: {
            id: offering.id,
            institution: offering.subject.institution,
            subject: { code: offering.subject.subjectCode, name: offering.subject.subjectName },
            term: offering.term,
        },
    });
}

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

    const [viewer, roleAssignment, workSession] = await Promise.all([
        db.user.findUnique({
            where: { id: claims.sub },
            select: { id: true, firstName: true, lastName: true, avatarKey: true },
        }),
        db.roleAssignment.findFirst({
            where: { id: claims.roleAssignmentId, userId: claims.sub },
            select: {
                id: true,
                role: { select: { id: true, roleCode: true, roleName: true, scopeType: true } },
            },
        }),
        db.assignmentWorkSession.findFirst({
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
                tool: { select: { id: true, code: true, name: true, description: true } },
                toolVersion: { select: { id: true, version: true, entryPath: true } },
                workspace: {
                    select: {
                        workspace: { select: { id: true, name: true, createdAt: true, lastOpenedAt: true } },
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
        }),
    ]);

    if (!viewer || !roleAssignment || !workSession?.toolVersion) {
        return errorResponse(404, 'NOT_FOUND', 'Tool session context no longer exists');
    }

    const attempt = workSession.workspace.attempt;
    const assessment = attempt.assessment;
    const offering = assessment.offering;
    return jsonResponse({
        apiVersion: 'v1',
        platform: {
            dashboardUrl: new URL('/navigation/dashboard', platformOrigin()).toString(),
        },
        user: {
            id: viewer.id,
            displayName: `${viewer.firstName} ${viewer.lastName}`.trim(),
            avatarUrl: pictureUrl(viewer.avatarKey) ?? null,
        },
        role: roleAssignment.role,
        tool: {
            ...workSession.tool,
            version: {
                id: workSession.toolVersion.id,
                version: workSession.toolVersion.version,
                entry: workSession.toolVersion.entryPath,
            },
        },
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

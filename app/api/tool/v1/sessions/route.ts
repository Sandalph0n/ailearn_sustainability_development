import { NextRequest, NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { ToolSessionRequestSchema } from '@/lib/tools/api-contract';
import { readToolJson } from '@/lib/tools/api-request';
import { toolRuntimeCookieName, toolRuntimeCookieOptions } from '@/lib/tools/runtime-cookie';
import {
    startToolReplaySession,
    startToolWorkSession,
    ToolSessionError,
} from '@/lib/tools/session-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to launch a tool');

    const body = await readToolJson(request, 16 * 1024);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = ToolSessionRequestSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Tool session data is invalid');
    }

    try {
        const grant = parsed.data.mode === 'WORK'
            ? await startToolWorkSession({ userId: session.user.id, loginSessionId: session.session.id, ...parsed.data })
            : await startToolReplaySession({ userId: session.user.id, loginSessionId: session.session.id, ...parsed.data });
        const response = jsonResponse(grant.response, { status: parsed.data.mode === 'WORK' ? 201 : 200 });
        response.cookies.set(
            toolRuntimeCookieName(grant.toolVersionId),
            grant.response.token,
            toolRuntimeCookieOptions(grant.toolCode, grant.toolVersionId),
        );
        return response;
    } catch (error) {
        if (error instanceof ToolSessionError) {
            return errorResponse(error.status, error.code, error.message);
        }
        console.error('Failed to create tool session', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'The tool session could not be created');
    }
}

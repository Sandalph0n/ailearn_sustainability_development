import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { guardToolApi } from '@/lib/tools/api-auth';
import { toolRuntimeCookieName, toolRuntimeCookieOptions } from '@/lib/tools/runtime-cookie';
import { refreshToolSession, ToolSessionError } from '@/lib/tools/session-service';

export const runtime = 'nodejs';

/**
 * Refresh before expiry. The bearer token is the CSRF-resistant credential here because a
 * sandboxed third-party runtime has an opaque origin and cannot use the platform login cookie.
 * An expired bearer requires a normal platform relaunch.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolApi(request);
    if (!guard.ok) return guard.response;

    try {
        const grant = await refreshToolSession(guard.claims);
        const response = jsonResponse(grant.response);
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
        console.error('Failed to refresh tool token', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'The tool token could not be refreshed');
    }
}

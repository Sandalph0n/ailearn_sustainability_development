import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { guardToolApi } from '@/lib/tools/api-auth';
import { toolRuntimeCookieName, toolRuntimeCookieOptions } from '@/lib/tools/runtime-cookie';
import { isToolRuntimeRequest } from '@/lib/tools/runtime-origin';

export const runtime = 'nodejs';

/** Exchange the launch JWT for a host-only cookie before protected runtime assets are loaded. */
export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isToolRuntimeRequest(request)) {
        return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'Runtime authentication is only available on the tool origin');
    }

    const guard = await guardToolApi(request);
    if (!guard.ok) return guard.response;

    const version = await db.toolVersion.findFirst({
        where: {
            id: guard.claims.toolVersionId,
            toolId: guard.claims.toolId,
        },
        select: {
            id: true,
            entryPath: true,
            tool: { select: { code: true } },
        },
    });
    if (!version) return errorResponse(404, 'NOT_FOUND', 'Tool version not found');

    const encodedEntry = version.entryPath.split('/').map(encodeURIComponent).join('/');
    const runtimePath = `/tools/${encodeURIComponent(version.tool.code)}/${version.id}/${encodedEntry}`;
    const response = jsonResponse({ runtimePath });
    response.cookies.set(
        toolRuntimeCookieName(version.id),
        request.headers.get('authorization')!.slice('Bearer '.length).trim(),
        toolRuntimeCookieOptions(),
    );
    return response;
}

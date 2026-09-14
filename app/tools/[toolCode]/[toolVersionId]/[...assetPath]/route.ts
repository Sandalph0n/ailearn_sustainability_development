import { NextRequest } from 'next/server';
import { z } from 'zod';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { getObject } from '@/lib/storage/objects';
import { toolRuntimeCookieName, toolRuntimeCookieOptions } from '@/lib/tools/runtime-cookie';
import { isToolRuntimeRequest } from '@/lib/tools/runtime-origin';
import { refreshToolSession, ToolSessionError } from '@/lib/tools/session-service';
import { verifyToolToken } from '@/lib/tools/token';

export const runtime = 'nodejs';

const TOOL_CODE = /^[a-z0-9-]{2,40}$/;

function safeAssetPath(parts: string[]): string | null {
    if (
        parts.length === 0 ||
        parts.some(
            (part) =>
                !part ||
                part === '.' ||
                part === '..' ||
                part.includes('/') ||
                part.includes('\\') ||
                part.includes('\0'),
        )
    ) {
        return null;
    }
    return parts.join('/');
}

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/tools/[toolCode]/[toolVersionId]/[...assetPath]'>,
): Promise<Response> {
    const { toolCode, toolVersionId, assetPath } = await params;
    const path = safeAssetPath(assetPath);
    if (!TOOL_CODE.test(toolCode) || !z.uuid().safeParse(toolVersionId).success || !path) {
        return new Response('Not found', { status: 404 });
    }

    const version = await db.toolVersion.findFirst({
        where: { id: toolVersionId, tool: { code: toolCode } },
        select: { storagePrefix: true, entryPath: true },
    });
    if (!version) return new Response('Not found', { status: 404 });

    // The executable entry requires an authorized launch. Hashed package assets are immutable and
    // contain no workspace data; keeping them cookie-free also lets sandboxed VS Code webviews and
    // their service worker load normally. Every data/API request remains protected by its bearer.
    if (path === version.entryPath) {
        const token = request.cookies.get(toolRuntimeCookieName(toolVersionId))?.value;
        if (!token) return new Response('Tool runtime authorization required', { status: 401 });

        try {
            const claims = await verifyToolToken(token);
            if (claims.toolVersionId !== toolVersionId) {
                return new Response('Tool runtime authorization does not match this version', { status: 403 });
            }
        } catch {
            return new Response('Tool runtime authorization expired', { status: 401 });
        }
    }

    const object = await getObject({ bucket: 'tools', key: `${version.storagePrefix}${path}` });
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers({
        'Content-Type': object.contentType,
        'Cache-Control': path === version.entryPath ? 'private, no-store' : 'private, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.split('/').at(-1) ?? 'asset')}`,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'Content-Security-Policy': [
            "default-src 'none'",
            "base-uri 'none'",
            "object-src 'none'",
            "form-action 'none'",
            // Keep the runtime entry out of foreign frames, while allowing VS Code's own
            // packaged webview HTML to render inside its same-origin editor iframe.
            path === version.entryPath ? "frame-ancestors 'none'" : "frame-ancestors 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "frame-src 'self'",
            "connect-src 'self'",
            "worker-src 'self' data: blob:",
        ].join('; '),
    });
    if (object.contentLength !== undefined) headers.set('Content-Length', String(object.contentLength));
    return new Response(object.body, { headers });
}

/** Recover the API bearer from this tool version's path-bound HttpOnly cookie after refresh. */
export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/tools/[toolCode]/[toolVersionId]/[...assetPath]'>,
) {
    if (!isToolRuntimeRequest(request)) {
        return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'Runtime authentication is only available on the tool origin');
    }

    const { toolCode, toolVersionId, assetPath } = await params;
    if (assetPath.join('/') !== '__lernumi/token') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
    }

    const token = request.cookies.get(toolRuntimeCookieName(toolVersionId))?.value;
    if (!token) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'The tool launch credential is missing');
    }

    try {
        const claims = await verifyToolToken(token);
        if (claims.toolVersionId !== toolVersionId) {
            return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'The credential does not match this tool version');
        }

        const grant = await refreshToolSession(claims);
        if (grant.toolCode !== toolCode || grant.toolVersionId !== toolVersionId) {
            return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'The credential does not match this tool');
        }

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
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'The tool launch credential is invalid or expired');
    }
}

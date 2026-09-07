import { NextRequest } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { getObject } from '@/lib/storage/objects';
import { toolRuntimeCookieName } from '@/lib/tools/runtime-cookie';
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

    const token = request.cookies.get(toolRuntimeCookieName(toolVersionId))?.value;
    if (!token) return new Response('Tool runtime authorization required', { status: 401 });

    let claims;
    try {
        claims = await verifyToolToken(token);
    } catch {
        return new Response('Tool runtime authorization expired', { status: 401 });
    }
    if (claims.toolVersionId !== toolVersionId) {
        return new Response('Tool runtime authorization does not match this version', { status: 403 });
    }

    const version = await db.toolVersion.findFirst({
        where: { id: toolVersionId, toolId: claims.toolId, tool: { code: toolCode } },
        select: { storagePrefix: true, entryPath: true },
    });
    if (!version) return new Response('Not found', { status: 404 });

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
            "default-src 'self'",
            "base-uri 'none'",
            "object-src 'none'",
            "form-action 'none'",
            "frame-ancestors 'self'",
            "script-src 'self' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "worker-src 'self' blob:",
        ].join('; '),
    });
    if (object.contentLength !== undefined) headers.set('Content-Length', String(object.contentLength));
    return new Response(object.body, { headers });
}

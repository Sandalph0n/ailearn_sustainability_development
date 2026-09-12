import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session/cookie';

const TOOL_RUNTIME_ORIGIN = process.env.TOOL_RUNTIME_ORIGIN || 'http://127.0.0.1:3000';
const TOOL_RUNTIME_HOST = new URL(TOOL_RUNTIME_ORIGIN).host.toLowerCase();
const RUNTIME_ASSET_PATH = /^\/tools\/[a-z0-9-]{2,40}\/[0-9a-f-]{36}\/.+/;
const PUBLIC_PATHS = new Set(['/', '/auth']);

function notFound(): NextResponse {
    return new NextResponse('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

/**
 * Keep the platform and uploaded runtimes on separate browser origins, then perform the existing
 * optimistic login-cookie redirect for normal platform pages. Authorization remains in routes.
 */
export default function proxy(request: NextRequest): NextResponse {
    const host = (request.headers.get('host') || '').toLowerCase();
    const path = request.nextUrl.pathname;
    const isToolHost = host === TOOL_RUNTIME_HOST;

    if (isToolHost) {
        const allowed =
            path === '/tool-runtime/bootstrap' ||
            RUNTIME_ASSET_PATH.test(path) ||
            path.startsWith('/api/tool/v1/') ||
            path.startsWith('/_next/');
        return allowed ? NextResponse.next() : notFound();
    }

    if (
        path === '/tool-runtime/bootstrap' ||
        path === '/api/tool/v1/runtime-auth' ||
        RUNTIME_ASSET_PATH.test(path)
    ) {
        return notFound();
    }

    // API handlers authenticate themselves. Static assets must never be redirected to HTML.
    if (
        path.startsWith('/api/') ||
        path.startsWith('/_next/') ||
        /\.(?:png|jpg|jpeg|svg|ico)$/.test(path)
    ) {
        return NextResponse.next();
    }

    const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
    if (hasSessionCookie && path === '/auth') {
        return NextResponse.redirect(new URL('/navigation/dashboard', request.nextUrl));
    }

    if (!hasSessionCookie && !PUBLIC_PATHS.has(path)) {
        const target = request.nextUrl.clone();
        target.pathname = '/auth';
        target.search = '';
        target.searchParams.set('next', path);
        return NextResponse.redirect(target);
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/:path*',
};

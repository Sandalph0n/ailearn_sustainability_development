import 'server-only';

import { TOOL_TOKEN_TTL_SECONDS } from '@/lib/tools/token';

export function toolRuntimeCookieName(toolVersionId: string): string {
    // The cookie is deliberately path-bound to one tool version below, so it cannot use the
    // __Host- prefix (which requires Path=/). __Secure- retains the HTTPS requirement in prod.
    const prefix = process.env.NODE_ENV === 'production' ? '__Secure-' : '';
    return `${prefix}lernumi_tool_runtime_${toolVersionId.replaceAll('-', '')}`;
}

export function toolRuntimeCookieOptions(toolCode: string, toolVersionId: string) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: TOOL_TOKEN_TTL_SECONDS,
        path: `/tools/${encodeURIComponent(toolCode)}/${encodeURIComponent(toolVersionId)}/`,
        priority: 'high' as const,
    };
}

import 'server-only';

import { TOOL_TOKEN_TTL_SECONDS } from '@/lib/tools/token';

export function toolRuntimeCookieName(toolVersionId: string): string {
    const prefix = process.env.NODE_ENV === 'production' ? '__Host-' : '';
    return `${prefix}lernumi_tool_runtime_${toolVersionId.replaceAll('-', '')}`;
}

export function toolRuntimeCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: TOOL_TOKEN_TTL_SECONDS,
        path: '/',
        priority: 'high' as const,
    };
}

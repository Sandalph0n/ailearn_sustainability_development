import 'server-only';

import { TOOL_TOKEN_TTL_SECONDS } from '@/lib/tools/token';

export function toolRuntimeCookieName(toolVersionId: string): string {
    return `ailearn_tool_runtime_${toolVersionId.replaceAll('-', '')}`;
}

export function toolRuntimeCookieOptions(toolCode: string, toolVersionId: string) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: TOOL_TOKEN_TTL_SECONDS,
        path: `/tools/${encodeURIComponent(toolCode)}/${toolVersionId}`,
        priority: 'high' as const,
    };
}

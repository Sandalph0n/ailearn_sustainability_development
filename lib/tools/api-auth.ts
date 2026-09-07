import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';

import { errorResponse } from '@/lib/auth/http/response';
import {
    bearerToken,
    verifyToolToken,
    type ToolCapability,
} from '@/lib/tools/token';

export type ToolClaims = Awaited<ReturnType<typeof verifyToolToken>>;

type ToolGuardResult =
    | { ok: true; claims: ToolClaims }
    | { ok: false; response: NextResponse };

/** JWT is the authority at tool API boundaries; route/body ids never widen its scope. */
export async function guardToolApi(
    request: NextRequest,
    requiredCapability?: ToolCapability,
): Promise<ToolGuardResult> {
    const token = bearerToken(request);
    if (!token) {
        return {
            ok: false,
            response: errorResponse(401, 'AUTHENTICATION_REQUIRED', 'A tool bearer token is required'),
        };
    }

    let claims: ToolClaims;
    try {
        claims = await verifyToolToken(token);
    } catch {
        return {
            ok: false,
            response: errorResponse(401, 'AUTHENTICATION_REQUIRED', 'The tool token is invalid or expired'),
        };
    }

    if (requiredCapability && !claims.capabilities.includes(requiredCapability)) {
        return {
            ok: false,
            response: errorResponse(403, 'AUTHORIZATION_FORBIDDEN', `The token does not grant ${requiredCapability}`),
        };
    }

    return { ok: true, claims };
}

export function guardToolWrite(claims: ToolClaims): NextResponse | null {
    if (claims.mode !== 'OWNER' || claims.readOnly) {
        return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', 'This tool session is read-only');
    }
    return null;
}

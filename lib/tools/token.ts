import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

import { ToolCapabilitySchema, type ToolCapability } from './api-contract';

export const TOOL_TOKEN_ISSUER = 'lernumi';
export const TOOL_TOKEN_AUDIENCE = 'lernumi-tool-api';
export const TOOL_TOKEN_TTL_SECONDS = 3 * 60 * 60;

export { ToolCapabilitySchema, type ToolCapability } from './api-contract';

const ToolClaimsSchema = z.object({
    sub: z.uuid(),
    jti: z.uuid(),
    toolId: z.uuid(),
    toolVersionId: z.uuid(),
    workSessionId: z.uuid(),
    assignmentWorkspaceId: z.uuid(),
    roleAssignmentId: z.uuid(),
    loginSessionId: z.uuid(),
    workspaceKind: z.enum(['ASSIGNMENT', 'PERSONAL']),
    sessionStartedAt: z.iso.datetime({ offset: true }),
    mode: z.enum(['OWNER', 'REVIEWER']),
    readOnly: z.boolean(),
    capabilities: z.array(ToolCapabilitySchema),
});

export type ToolTokenContext = Omit<z.infer<typeof ToolClaimsSchema>, 'jti' | 'sub'> & {
    userId: string;
};

/**
 * Token sống ngắn để API của tool không phải tra login session/RBAC cho từng batch. Khi refresh
 * token, server lại kiểm quyền đầy đủ. Bản demo giữ token trong ba giờ để một buổi làm việc dài
 * không phụ thuộc vào refresh liên tục; production nên cân nhắc rút ngắn khoảng này.
 */
export async function signToolToken(context: ToolTokenContext): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
        toolId: context.toolId,
        toolVersionId: context.toolVersionId,
        workSessionId: context.workSessionId,
        assignmentWorkspaceId: context.assignmentWorkspaceId,
        roleAssignmentId: context.roleAssignmentId,
        loginSessionId: context.loginSessionId,
        workspaceKind: context.workspaceKind,
        sessionStartedAt: context.sessionStartedAt,
        mode: context.mode,
        readOnly: context.readOnly,
        capabilities: context.capabilities,
    })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(TOOL_TOKEN_ISSUER)
        .setAudience(TOOL_TOKEN_AUDIENCE)
        .setSubject(context.userId)
        .setJti(crypto.randomUUID())
        .setIssuedAt(now)
        .setExpirationTime(now + TOOL_TOKEN_TTL_SECONDS)
        .sign(toolTokenKey());
}

export async function verifyToolToken(
    token: string,
    requiredCapability?: ToolCapability,
): Promise<z.infer<typeof ToolClaimsSchema>> {
    const result = await jwtVerify(token, toolTokenKey(), {
        algorithms: ['HS256'],
        issuer: TOOL_TOKEN_ISSUER,
        audience: TOOL_TOKEN_AUDIENCE,
    });
    const claims = ToolClaimsSchema.parse(result.payload);
    if (requiredCapability && !claims.capabilities.includes(requiredCapability)) {
        throw new Error(`Tool token does not grant ${requiredCapability}`);
    }
    return claims;
}

export function bearerToken(request: Request): string | null {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
}

function toolTokenKey(): Uint8Array {
    const secret = process.env.TOOL_TOKEN_SECRET;
    if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
        throw new Error('TOOL_TOKEN_SECRET must contain at least 32 bytes');
    }
    return new TextEncoder().encode(secret);
}

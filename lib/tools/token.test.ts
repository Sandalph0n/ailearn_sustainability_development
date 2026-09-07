import { afterEach, describe, expect, it, vi } from 'vitest';

import { signToolToken, verifyToolToken } from './token';

const context = {
    userId: '10000000-0000-4000-8000-000000000001',
    toolId: '10000000-0000-4000-8000-000000000002',
    toolVersionId: '10000000-0000-4000-8000-000000000003',
    workSessionId: '10000000-0000-4000-8000-000000000004',
    assignmentWorkspaceId: '10000000-0000-4000-8000-000000000005',
    roleAssignmentId: '10000000-0000-4000-8000-000000000006',
    loginSessionId: '10000000-0000-4000-8000-000000000007',
    mode: 'OWNER' as const,
    readOnly: false,
    capabilities: ['files:read', 'files:write', 'events:append'] as const,
};

afterEach(() => vi.unstubAllEnvs());

describe('tool JWT', () => {
    it('round-trips the pinned session context', async () => {
        vi.stubEnv('TOOL_TOKEN_SECRET', 'unit-test-secret-that-is-at-least-thirty-two-bytes');
        const token = await signToolToken({ ...context, capabilities: [...context.capabilities] });
        const claims = await verifyToolToken(token, 'events:append');

        expect(claims.sub).toBe(context.userId);
        expect(claims.toolVersionId).toBe(context.toolVersionId);
        expect(claims.roleAssignmentId).toBe(context.roleAssignmentId);
        expect(claims.loginSessionId).toBe(context.loginSessionId);
        expect(claims.capabilities).not.toContain('replay:read');
    });

    it('refuses a capability absent from the signed token', async () => {
        vi.stubEnv('TOOL_TOKEN_SECRET', 'unit-test-secret-that-is-at-least-thirty-two-bytes');
        const token = await signToolToken({ ...context, capabilities: [...context.capabilities] });
        await expect(verifyToolToken(token, 'replay:read')).rejects.toThrow(
            'does not grant replay:read',
        );
    });

    it('rejects a short signing secret', async () => {
        vi.stubEnv('TOOL_TOKEN_SECRET', 'too-short');
        await expect(
            signToolToken({ ...context, capabilities: [...context.capabilities] }),
        ).rejects.toThrow('at least 32 bytes');
    });
});

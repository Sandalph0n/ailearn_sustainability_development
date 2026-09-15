import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const TOOL_ASSET =
    '/tools/code-editor/c94e4712-ab95-46ca-b200-99852c6d4f30/assets/service-worker-CKLuNTjR.js';

async function loadProxy({ sharedHost }: { sharedHost: boolean }) {
    vi.resetModules();
    vi.stubEnv('PLATFORM_ORIGIN', 'https://lernumi-demo.vercel.app');
    vi.stubEnv(
        'TOOL_RUNTIME_ORIGIN',
        sharedHost ? 'https://lernumi-demo.vercel.app' : 'https://tools.lernumi.example',
    );
    return (await import('../proxy')).default;
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('runtime routing proxy', () => {
    it('does not redirect a service-worker asset on the shared demo host', async () => {
        const proxy = await loadProxy({ sharedHost: true });
        const response = proxy(
            new NextRequest(`https://lernumi-demo.vercel.app${TOOL_ASSET}?v=5`),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('x-middleware-next')).toBe('1');
        expect(response.headers.get('location')).toBeNull();
    });

    it('keeps ordinary platform pages behind the session-cookie redirect', async () => {
        const proxy = await loadProxy({ sharedHost: true });
        const response = proxy(
            new NextRequest('https://lernumi-demo.vercel.app/navigation/dashboard'),
        );

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://lernumi-demo.vercel.app/auth?next=%2Fnavigation%2Fdashboard',
        );
    });

    it('keeps runtime paths off the platform host when origins are split', async () => {
        const proxy = await loadProxy({ sharedHost: false });
        const response = proxy(
            new NextRequest(`https://lernumi-demo.vercel.app${TOOL_ASSET}`),
        );

        expect(response.status).toBe(404);
    });
});

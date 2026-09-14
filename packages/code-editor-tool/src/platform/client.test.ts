import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToolApiClient, unquoteEtag } from './client';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ToolApiClient.fromLaunchLocation', () => {
    it('uses the one-time launch fragment and removes it from browser history', async () => {
        const replaceState = vi.fn();
        const fetch = vi.fn(async () => new Response('{}'));
        vi.stubGlobal('history', { replaceState });
        vi.stubGlobal('fetch', fetch);

        await ToolApiClient.fromLaunchLocation({
            hash: '#lernumi_token=launch-token&lernumi_api=v1',
            pathname: '/tools/code-editor/version/index.html',
            search: '?preview=true',
            href: 'http://tools.localhost:3000/tools/code-editor/version/index.html?preview=true#lernumi_token=launch-token&lernumi_api=v1',
        } as Location);

        expect(fetch).not.toHaveBeenCalled();
        expect(replaceState).toHaveBeenCalledWith(
            null,
            '',
            '/tools/code-editor/version/index.html?preview=true',
        );
    });

    it('recovers a bearer from the path-bound HttpOnly cookie after refresh', async () => {
        const fetch = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'resumed-token', expiresIn: 300 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: 'session-id' } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));
        vi.stubGlobal('fetch', fetch);

        const client = await ToolApiClient.fromLaunchLocation({
            hash: '',
            pathname: '/tools/code-editor/version/index.html',
            search: '',
            href: 'http://tools.localhost:3000/tools/code-editor/version/index.html',
        } as Location);
        await client.context();

        expect(fetch).toHaveBeenNthCalledWith(1, '__lernumi/token', {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
        });
        const [contextUrl, contextInit] = fetch.mock.calls[1]!;
        expect(contextUrl.toString()).toBe('http://tools.localhost:3000/api/tool/v1/context');
        expect(new Headers(contextInit.headers).get('Authorization')).toBe('Bearer resumed-token');
    });
});

describe('unquoteEtag', () => {
    it('accepts strong and weak HTTP entity tags', () => {
        expect(unquoteEtag('"abc"')).toBe('abc');
        expect(unquoteEtag('W/"abc"')).toBe('abc');
        expect(unquoteEtag('abc')).toBe('abc');
        expect(unquoteEtag(null)).toBeNull();
    });
});

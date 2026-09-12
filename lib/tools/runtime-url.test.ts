import { describe, expect, it } from 'vitest';

import { isToolRuntimeRequest } from './runtime-origin';
import { buildToolRuntimeUrl } from './runtime-url';

describe('tool runtime launch URL', () => {
    it('targets the isolated host and keeps credentials in the fragment', () => {
        const result = buildToolRuntimeUrl('signed.token/value');
        const url = new URL(result);

        expect(url.origin).toBe('http://127.0.0.1:3000');
        expect(url.pathname).toBe('/tool-runtime/bootstrap');
        expect(url.search).toBe('');
        expect(new URLSearchParams(url.hash.slice(1)).get('lernumi_token')).toBe(
            'signed.token/value',
        );
        expect(new URLSearchParams(url.hash.slice(1)).get('lernumi_api')).toBe('v1');
    });
});

describe('tool runtime host boundary', () => {
    it('accepts the configured tool host even when Next normalizes nextUrl.origin', () => {
        const request = new Request('http://localhost:3000/api/tool/v1/runtime-auth', {
            headers: { host: '127.0.0.1:3000' },
        });

        expect(isToolRuntimeRequest(request)).toBe(true);
    });

    it('rejects the platform host', () => {
        const request = new Request('http://localhost:3000/api/tool/v1/runtime-auth', {
            headers: { host: 'localhost:3000' },
        });

        expect(isToolRuntimeRequest(request)).toBe(false);
    });

    it('uses the proxy-forwarded host when one is present', () => {
        const request = new Request('http://internal:3000/api/tool/v1/runtime-auth', {
            headers: {
                host: 'internal:3000',
                'x-forwarded-host': '127.0.0.1:3000',
            },
        });

        expect(isToolRuntimeRequest(request)).toBe(true);
    });
});

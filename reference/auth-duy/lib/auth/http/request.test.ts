// File này kiểm thử việc đọc auth request và chống request khác origin.
import { describe, expect, it } from 'vitest';

import { isSameOriginRequest, readAuthJson } from './request';

describe('readAuthJson', () => {
    it('reads JSON with the correct content type', async () => {
        const request = new Request('https://example.com/api/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ email: 'student@example.com' }),
        });

        await expect(readAuthJson(request)).resolves.toEqual({
            ok: true,
            value: { email: 'student@example.com' },
        });
    });

    it('rejects a non-JSON content type', async () => {
        const request = new Request('https://example.com/api/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: '{}',
        });

        await expect(readAuthJson(request)).resolves.toEqual({
            ok: false,
            reason: 'wrong_content_type',
        });
    });
});

describe('isSameOriginRequest', () => {
    it('accepts an origin with the same host', () => {
        const request = new Request('https://example.com/api/auth/logout', {
            method: 'POST',
            headers: { origin: 'https://example.com', host: 'example.com' },
        });

        expect(isSameOriginRequest(request)).toBe(true);
    });

    it('rejects an origin with a different host', () => {
        const request = new Request('https://example.com/api/auth/logout', {
            method: 'POST',
            headers: { origin: 'https://attacker.example', host: 'example.com' },
        });

        expect(isSameOriginRequest(request)).toBe(false);
    });

    it('does not let x-forwarded-host override the real Host header', () => {
        const request = new Request('https://example.com/api/auth/logout', {
            method: 'POST',
            headers: {
                origin: 'https://attacker.example',
                host: 'example.com',
                'x-forwarded-host': 'attacker.example',
            },
        });

        expect(isSameOriginRequest(request)).toBe(false);
    });

    it('rejects a request marked as cross-site by the browser', () => {
        const request = new Request('https://example.com/api/auth/logout', {
            method: 'POST',
            headers: { 'sec-fetch-site': 'cross-site' },
        });

        expect(isSameOriginRequest(request)).toBe(false);
    });
});

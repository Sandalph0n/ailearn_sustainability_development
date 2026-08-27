// File này kiểm thử entropy, định dạng và kết quả băm của session token.
import { describe, expect, it } from 'vitest';

import { generateSessionToken, hashSessionToken } from './token';

describe('session token', () => {
    it('generates unique tokens with sufficient entropy', () => {
        const tokens = new Set(Array.from({ length: 100 }, generateSessionToken));

        expect(tokens.size).toBe(100);
        for (const token of tokens) {
            expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        }
    });

    it('hashes tokens deterministically with SHA-256', () => {
        expect(hashSessionToken('token')).toBe(
            '3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0',
        );
        expect(hashSessionToken('token')).not.toContain('token');
    });
});

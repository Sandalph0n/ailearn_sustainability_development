// File này kiểm thử việc băm, xác minh và nhận diện password hash cần nâng cấp.
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let password: typeof import('./hash');

beforeAll(async () => {
    password = await import('./hash');
});

describe('password hashing', () => {
    it('hashes and verifies passwords with Argon2id', async () => {
        const hash = await password.hashPassword('correct horse battery staple');

        expect(hash).toMatch(/^\$argon2id\$/);
        await expect(password.verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
        await expect(password.verifyPassword(hash, 'wrong password')).resolves.toBe(false);
        expect(password.passwordHashNeedsUpgrade(hash)).toBe(false);
    });

    it('treats a malformed hash as invalid credentials', async () => {
        await expect(password.verifyPassword('not-a-password-hash', 'password')).resolves.toBe(false);
        expect(password.passwordHashNeedsUpgrade('not-a-password-hash')).toBe(true);
    });
});

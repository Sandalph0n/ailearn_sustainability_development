// File này kiểm thử quy tắc validation và chuẩn hóa dữ liệu auth đầu vào.
import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from './credentials';

describe('registerSchema', () => {
    it('normalizes email and names without trimming the password', () => {
        const result = registerSchema.parse({
            email: '  Student@Example.COM  ',
            password: '  password with spaces  ',
            firstName: '  An  ',
            lastName: '  Nguyen  ',
            institutionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        });

        expect(result.email).toBe('student@example.com');
        expect(result.password).toBe('  password with spaces  ');
        expect(result.firstName).toBe('An');
        expect(result.lastName).toBe('Nguyen');
    });

    it('rejects a short password and an invalid institutionId', () => {
        const result = registerSchema.safeParse({
            email: 'student@example.com',
            password: 'short',
            firstName: 'An',
            lastName: 'Nguyen',
            institutionId: 'not-a-uuid',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
                expect.arrayContaining(['password', 'institutionId']),
            );
        }
    });
});

describe('loginSchema', () => {
    it('does not apply the new password policy during login', () => {
        const result = loginSchema.parse({ email: 'USER@EXAMPLE.COM', password: 'old' });

        expect(result).toEqual({ email: 'user@example.com', password: 'old' });
    });
});

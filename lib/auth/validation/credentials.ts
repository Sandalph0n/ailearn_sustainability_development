// File này định nghĩa schema kiểm tra và chuẩn hóa dữ liệu đăng ký, đăng nhập.
import { z } from 'zod';

const emailSchema = z
    .string({ error: 'Email must be a string' })
    .trim()
    .min(1, 'Email is required')
    .max(254, 'Email must not exceed 254 characters')
    .email('Email is invalid')
    .transform((email) => email.toLowerCase());

const passwordSchema = z
    .string({ error: 'Password must be a string' })
    .min(12, 'Password must contain at least 12 characters')
    .max(128, 'Password must not exceed 128 characters');

const nameSchema = z
    .string({ error: 'Name must be a string' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters');

export const registerSchema = z.strictObject({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    institutionId: z.uuid('institutionId must be a valid UUID'),
});

export const loginSchema = z.strictObject({
    email: emailSchema,
    password: z
        .string({ error: 'Password must be a string' })
        .min(1, 'Password is required')
        .max(128, 'Password must not exceed 128 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type ValidationErrors = Record<string, string[]>;

export function formatValidationErrors(error: z.ZodError): ValidationErrors {
    const fields: ValidationErrors = {};

    for (const issue of error.issues) {
        const field = typeof issue.path[0] === 'string' ? issue.path[0] : '_form';
        fields[field] ??= [];
        fields[field].push(issue.message);
    }

    return fields;
}

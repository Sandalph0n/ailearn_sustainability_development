// File này đọc cấu hình thời hạn session và định nghĩa thuộc tính bảo mật của cookie.
import 'server-only';

export const SESSION_COOKIE_NAME = 'ailearn_session';

const DEFAULT_SESSION_TTL_DAYS = 7;
const MIN_SESSION_TTL_DAYS = 1;
const MAX_SESSION_TTL_DAYS = 90;

function readSessionTtlDays(): number {
    const value = process.env.AUTH_SESSION_TTL_DAYS;
    if (value === undefined || value === '') {
        return DEFAULT_SESSION_TTL_DAYS;
    }

    const days = Number(value);
    if (!Number.isInteger(days) || days < MIN_SESSION_TTL_DAYS || days > MAX_SESSION_TTL_DAYS) {
        throw new Error(
            `AUTH_SESSION_TTL_DAYS must be an integer between ${MIN_SESSION_TTL_DAYS} and ${MAX_SESSION_TTL_DAYS}`,
        );
    }

    return days;
}

export function getSessionExpiresAt(now = new Date()): Date {
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + readSessionTtlDays());
    return expiresAt;
}

export function getSessionCookieOptions(expiresAt: Date) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        expires: expiresAt,
        path: '/',
        priority: 'high' as const,
    };
}

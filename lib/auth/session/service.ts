// File này quản lý toàn bộ vòng đời database session và cookie đăng nhập.
import 'server-only';

import { cookies } from 'next/headers';

import {
    getSessionCookieOptions,
    getSessionExpiresAt,
    SESSION_COOKIE_NAME,
} from '@/lib/auth/session/config';
import { generateSessionToken, hashSessionToken } from '@/lib/auth/session/token';
import { db } from '@/lib/db';

const sessionUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    institutionId: true,
} as const;

export type AuthSession = {
    session: {
        id: string;
        expiresAt: Date;
    };
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        institutionId: string;
    };
};

export function prepareSession(userId: string) {
    const token = generateSessionToken();
    const expiresAt = getSessionExpiresAt();

    return {
        token,
        expiresAt,
        record: {
            userId,
            tokenHash: hashSessionToken(token),
            expiresAt,
        },
    };
}

export async function readSessionToken(): Promise<string | null> {
    return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
    (await cookies()).set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
    (await cookies()).set(SESSION_COOKIE_NAME, '', {
        ...getSessionCookieOptions(new Date(0)),
        maxAge: 0,
    });
}

export async function findSessionByToken(token: string): Promise<AuthSession | null> {
    const result = await db.session.findFirst({
        where: {
            tokenHash: hashSessionToken(token),
            expiresAt: { gt: new Date() },
        },
        select: {
            id: true,
            expiresAt: true,
            user: { select: sessionUserSelect },
        },
    });

    if (!result) {
        return null;
    }

    return {
        session: {
            id: result.id,
            expiresAt: result.expiresAt,
        },
        user: result.user,
    };
}

export async function getCurrentSession(): Promise<AuthSession | null> {
    const token = await readSessionToken();
    return token ? findSessionByToken(token) : null;
}

export async function replaceCurrentSession(userId: string): Promise<{ expiresAt: Date }> {
    const oldToken = await readSessionToken();
    const nextSession = prepareSession(userId);

    await db.$transaction(async (transaction) => {
        if (oldToken) {
            await transaction.session.deleteMany({
                where: { tokenHash: hashSessionToken(oldToken) },
            });
        }

        await transaction.session.create({ data: nextSession.record });
    });

    await setSessionCookie(nextSession.token, nextSession.expiresAt);
    return { expiresAt: nextSession.expiresAt };
}

export async function revokeCurrentSession(): Promise<void> {
    const token = await readSessionToken();

    if (token) {
        await db.session.deleteMany({
            where: { tokenHash: hashSessionToken(token) },
        });
    }

    await clearSessionCookie();
}

export async function revokeAllCurrentUserSessions(): Promise<boolean> {
    const currentSession = await getCurrentSession();
    if (!currentSession) {
        await clearSessionCookie();
        return false;
    }

    await db.session.deleteMany({
        where: { userId: currentSession.user.id },
    });
    await clearSessionCookie();
    return true;
}

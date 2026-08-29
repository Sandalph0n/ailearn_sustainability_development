// File này quản lý toàn bộ vòng đời database session và cookie đăng nhập.
import 'server-only';

import { cookies } from 'next/headers';

import type { Prisma } from '@/app/generated/prisma/client';
import {
    getSessionCookieOptions,
    getSessionExpiresAt,
    SESSION_COOKIE_NAME,
} from '@/lib/auth/session/config';
import { generateSessionToken, hashSessionToken } from '@/lib/auth/session/token';
import { db } from '@/lib/db';

/**
 * Các cột lấy ra kèm phiên. Khai báo ở ĐÚNG MỘT chỗ rồi để `AuthSession` suy ra từ đây.
 *
 * `satisfies` giữ nguyên kiểu cụ thể của object (nếu dùng `:` thì nó bị gọt thành `UserSelect`
 * chung chung và `UserGetPayload` bên dưới không suy ra được gì). Đổi tên cột trong Prisma thì
 * dòng này đỏ ngay, thay vì lặng lẽ trả về thiếu trường.
 *
 * KHÔNG có `institutionId`: người dùng có thể thuộc nhiều cơ sở, quan hệ đó nằm ở `RoleAssignment`.
 */
const sessionUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    // Đi kèm phiên vì chốt chặn `/admin` cần nó ở MỌI request. Truy vấn riêng thì thành hai lần
    // chạm database cho cùng một câu hỏi, và dễ có chỗ quên hỏi.
    isSystemAdmin: true,
} satisfies Prisma.UserSelect;

export type SessionUser = Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>;

export type AuthSession = {
    session: { id: string; expiresAt: Date };
    user: SessionUser;
};

/**
 * Dựng sẵn token và bản ghi phiên, CHƯA ghi xuống database.
 *
 * Tách rời để chỗ gọi tự quyết ghi vào transaction nào — `register` cần tạo user và phiên trong
 * cùng một transaction, nên hàm này không được tự ý ghi.
 *
 * Trả về cả `token` (gốc, để đặt vào cookie) lẫn `record.tokenHash` (băm, để ghi xuống database).
 */
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

/**
 * Tra phiên từ token trong cookie.
 *
 * `expiresAt: { gt: new Date() }` để phiên hết hạn không tra ra được, kể cả khi dòng đó chưa bị
 * dọn khỏi bảng.
 */
export async function findSessionByToken(token: string): Promise<AuthSession | null> {
    const result = await db.loginSession.findFirst({
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
        session: { id: result.id, expiresAt: result.expiresAt },
        user: result.user,
    };
}

/**
 * Ai đang đăng nhập. Đây là phép kiểm THẬT — `proxy.ts` chỉ nhìn thấy cookie có tồn tại hay không.
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
    const token = await readSessionToken();
    return token ? findSessionByToken(token) : null;
}

/**
 * Thay phiên cũ bằng phiên mới, dùng khi đăng nhập.
 *
 * Xoá phiên cũ trước khi tạo phiên mới là để chống session fixation: nếu kẻ tấn công dụ được nạn
 * nhân dùng một token do hắn biết, thì ngay khi nạn nhân đăng nhập, token đó chết.
 *
 * Cả hai việc nằm trong một transaction để không có khoảnh khắc nào người dùng mất cả hai phiên.
 */
export async function replaceCurrentSession(userId: string): Promise<{ expiresAt: Date }> {
    const oldToken = await readSessionToken();
    const nextSession = prepareSession(userId);

    await db.$transaction(async (transaction) => {
        if (oldToken) {
            await transaction.loginSession.deleteMany({
                where: { tokenHash: hashSessionToken(oldToken) },
            });
        }

        await transaction.loginSession.create({ data: nextSession.record });
    });

    await setSessionCookie(nextSession.token, nextSession.expiresAt);
    return { expiresAt: nextSession.expiresAt };
}

/** Đăng xuất thiết bị hiện tại. */
export async function revokeCurrentSession(): Promise<void> {
    const token = await readSessionToken();

    if (token) {
        await db.loginSession.deleteMany({
            where: { tokenHash: hashSessionToken(token) },
        });
    }

    // Xoá cookie kể cả khi không có token — người dùng bấm đăng xuất thì phải sạch, không bàn thêm.
    await clearSessionCookie();
}

/**
 * Đăng xuất MỌI thiết bị. Đây là nút bấm khi ai đó nghi tài khoản mình bị lộ.
 *
 * Trả về `false` nếu vốn chẳng có phiên nào hợp lệ để thu hồi.
 */
export async function revokeAllCurrentUserSessions(): Promise<boolean> {
    const currentSession = await getCurrentSession();
    if (!currentSession) {
        await clearSessionCookie();
        return false;
    }

    await db.loginSession.deleteMany({ where: { userId: currentSession.user.id } });
    await clearSessionCookie();
    return true;
}

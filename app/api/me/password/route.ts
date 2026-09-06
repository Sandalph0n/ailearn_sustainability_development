import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import { errorResponse, invalidBodyResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { hashPassword, verifyPassword } from '@/lib/auth/password/hash';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';

const passwordSchema = z.strictObject({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12, 'Use at least 12 characters').max(128),
});

export async function PATCH(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = passwordSchema.safeParse(body.value);
    if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid password');
    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
        return errorResponse(400, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }
    await db.user.update({ where: { id: session.user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
    await db.loginSession.deleteMany({
        where: { userId: session.user.id, id: { not: session.session.id } },
    });
    return jsonResponse({ updated: true });
}

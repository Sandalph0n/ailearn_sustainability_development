import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import { errorResponse, invalidBodyResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';

const profileSchema = z.strictObject({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
});

export async function PATCH(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = profileSchema.safeParse(body.value);
    if (!parsed.success) return errorResponse(400, 'VALIDATION_ERROR', 'Enter your first and last name');
    const user = await db.user.update({
        where: { id: session.user.id },
        data: parsed.data,
        select: { firstName: true, lastName: true, email: true },
    });
    return jsonResponse({ user });
}

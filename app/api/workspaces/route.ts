import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import { errorResponse, invalidBodyResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';

const createSchema = z.strictObject({
    name: z.string().trim().min(1, 'Enter a workspace name').max(120),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = createSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid workspace');
    }

    const workspace = await db.workspace.create({
        data: {
            name: parsed.data.name,
            personal: { create: { userId: session.user.id } },
        },
        select: { id: true, name: true, createdAt: true },
    });

    return jsonResponse({ workspace }, { status: 201 });
}

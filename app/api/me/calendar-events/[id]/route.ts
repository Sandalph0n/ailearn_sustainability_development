// Route này sửa và xoá một mục lịch cá nhân. Chỉ chủ mục mới thấy nó — người khác nhận 404.
import { NextRequest, NextResponse } from 'next/server';

import { badId } from '@/lib/admin/route-helpers';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { CalendarEventSchema } from '@/lib/calendar/event-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/me/calendar-events/[id]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = CalendarEventSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Event data is invalid', formatValidationErrors(parsed.error));
    }

    // `updateMany` với điều kiện userId: không có dòng nào khớp thì là của người khác (hoặc đã xoá).
    const result = await db.calendarEvent.updateMany({
        where: { id, userId: session.user.id },
        data: {
            title: parsed.data.title,
            note: parsed.data.note,
            startAt: new Date(parsed.data.startAt),
            endAt: new Date(parsed.data.endAt),
            offeringId: parsed.data.offeringId,
        },
    });
    if (result.count === 0) return errorResponse(404, 'NOT_FOUND', 'Event does not exist');
    return jsonResponse({ event: { id, ...parsed.data } });
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/me/calendar-events/[id]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const result = await db.calendarEvent.deleteMany({ where: { id, userId: session.user.id } });
    if (result.count === 0) return errorResponse(404, 'NOT_FOUND', 'Event does not exist');
    return new NextResponse(null, { status: 204 });
}

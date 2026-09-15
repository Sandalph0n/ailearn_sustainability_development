// Route này tạo một mục lịch cá nhân cho người đang đăng nhập.
import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = CalendarEventSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Event data is invalid', formatValidationErrors(parsed.error));
    }

    const event = await db.calendarEvent.create({
        data: {
            userId: session.user.id,
            title: parsed.data.title,
            note: parsed.data.note,
            startAt: new Date(parsed.data.startAt),
            endAt: new Date(parsed.data.endAt),
            offeringId: parsed.data.offeringId,
        },
        select: { id: true, title: true, note: true, startAt: true, endAt: true, offeringId: true },
    });
    return jsonResponse({ event: { ...event, startAt: event.startAt.toISOString(), endAt: event.endAt.toISOString() } }, { status: 201 });
}

// Route này đặt (tạo hoặc sửa) và bỏ kế hoạch làm một bài của người đang đăng nhập.
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
import { AssessmentPlanSchema } from '@/lib/calendar/plan-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/** Ngày dân sự → mốc UTC nửa đêm, đúng cách cột `DATE` của Prisma mong đợi. */
function toDate(day: string): Date {
    return new Date(`${day}T00:00:00.000Z`);
}

export async function PUT(
    request: NextRequest,
    { params }: RouteContext<'/api/me/assessment-plans/[assessmentId]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const { assessmentId } = await params;
    const invalid = badId(assessmentId);
    if (invalid) return invalid;

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);
    const parsed = AssessmentPlanSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Plan dates are invalid', formatValidationErrors(parsed.error));
    }

    // Chỉ lập kế hoạch cho bài đã công bố; bài nháp hay không tồn tại đều là 404 để không lộ gì.
    const assessment = await db.assessment.findFirst({
        where: { id: assessmentId, publishAt: { lte: new Date() } },
        select: { id: true },
    });
    if (!assessment) return errorResponse(404, 'NOT_FOUND', 'Assessment does not exist');

    const plan = await db.assessmentPlan.upsert({
        where: { userId_assessmentId: { userId: session.user.id, assessmentId } },
        create: {
            userId: session.user.id,
            assessmentId,
            startDate: toDate(parsed.data.startDate),
            endDate: toDate(parsed.data.endDate),
        },
        update: { startDate: toDate(parsed.data.startDate), endDate: toDate(parsed.data.endDate) },
        select: { assessmentId: true, startDate: true, endDate: true },
    });
    return jsonResponse({
        plan: {
            assessmentId: plan.assessmentId,
            startDate: plan.startDate.toISOString().slice(0, 10),
            endDate: plan.endDate.toISOString().slice(0, 10),
        },
    });
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/me/assessment-plans/[assessmentId]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();
    const session = await getCurrentSession();
    if (!session) return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');

    const { assessmentId } = await params;
    const invalid = badId(assessmentId);
    if (invalid) return invalid;

    await db.assessmentPlan.deleteMany({ where: { userId: session.user.id, assessmentId } });
    return new NextResponse(null, { status: 204 });
}

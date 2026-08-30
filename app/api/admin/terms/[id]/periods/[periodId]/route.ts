// Route này sửa hoặc xoá một period, đồng thời buộc nó thuộc đúng term trên URL.
import { NextRequest, NextResponse } from 'next/server';

import { jsonResponse } from '@/lib/auth/http/response';
import { badId, guardDelete, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { TermPeriodSchema } from '@/lib/admin/term-period-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/terms/[id]/periods/[periodId]'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, TermPeriodSchema, 'Term period');
    if (!guard.ok) return guard.response;

    const { id: studyTermId, periodId } = await params;
    const invalid = badId(studyTermId) ?? badId(periodId);
    if (invalid) return invalid;

    try {
        const period = await db.studyTermPeriod.update({
            where: { id: periodId, studyTermId },
            data: guard.data,
            select: { id: true, name: true },
        });
        return jsonResponse({ period });
    } catch (error) {
        return prismaError(error, 'Term period');
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/terms/[id]/periods/[periodId]'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id: studyTermId, periodId } = await params;
    const invalid = badId(studyTermId) ?? badId(periodId);
    if (invalid) return invalid;

    try {
        await db.studyTermPeriod.delete({ where: { id: periodId, studyTermId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Term period');
    }
}

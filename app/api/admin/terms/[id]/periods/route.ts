// Route này tạo period trong một term cụ thể.
import { NextRequest, NextResponse } from 'next/server';

import { jsonResponse } from '@/lib/auth/http/response';
import { badId, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { TermPeriodSchema } from '@/lib/admin/term-period-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/terms/[id]/periods'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, TermPeriodSchema, 'Term period');
    if (!guard.ok) return guard.response;

    const { id: studyTermId } = await params;
    const invalid = badId(studyTermId);
    if (invalid) return invalid;

    try {
        const period = await db.studyTermPeriod.create({
            data: { ...guard.data, studyTermId },
            select: { id: true, name: true },
        });
        return jsonResponse({ period }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Term period');
    }
}

import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { TermPeriodSchema } from '@/lib/admin/term-period-schema';
import { guardInstitutionWrite } from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/terms/[id]/periods'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.TERM_UPDATE,
        TermPeriodSchema,
        'Term period',
    );
    if (!guard.ok) return guard.response;

    const term = await db.studyTerm.findFirst({ where: { id, institutionId }, select: { id: true } });
    if (!term) return errorResponse(404, 'NOT_FOUND', 'Term does not exist');

    try {
        const period = await db.studyTermPeriod.create({
            data: { ...guard.data, studyTermId: id },
            select: { id: true, name: true },
        });
        return jsonResponse({ period }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Term period');
    }
}

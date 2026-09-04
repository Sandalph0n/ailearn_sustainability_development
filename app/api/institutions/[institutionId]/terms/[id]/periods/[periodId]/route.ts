import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { TermPeriodSchema } from '@/lib/admin/term-period-schema';
import {
    guardInstitutionAction,
    guardInstitutionWrite,
} from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/terms/[id]/periods/[periodId]'>,
): Promise<NextResponse> {
    const { institutionId, id, periodId } = await params;
    const invalid = badId(id) ?? badId(periodId);
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
        const period = await db.studyTermPeriod.update({
            where: { id: periodId, studyTermId: id },
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
    { params }: RouteContext<'/api/institutions/[institutionId]/terms/[id]/periods/[periodId]'>,
): Promise<NextResponse> {
    const { institutionId, id, periodId } = await params;
    const invalid = badId(id) ?? badId(periodId);
    if (invalid) return invalid;
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.TERM_DELETE,
    );
    if (!guard.ok) return guard.response;

    const term = await db.studyTerm.findFirst({ where: { id, institutionId }, select: { id: true } });
    if (!term) return errorResponse(404, 'NOT_FOUND', 'Term does not exist');

    try {
        await db.studyTermPeriod.delete({
            where: { id: periodId, studyTermId: id },
        });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Term period');
    }
}

import { NextRequest, NextResponse } from 'next/server';

import { InstitutionSchema } from '@/lib/admin/institution-schema';
import { prismaError } from '@/lib/admin/route-helpers';
import { guardInstitutionWrite } from '@/lib/auth/institution-route-guard';
import { jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/settings'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE,
        InstitutionSchema,
        'Institution',
    );
    if (!guard.ok) return guard.response;

    try {
        const institution = await db.institution.update({
            where: { id: institutionId },
            data: guard.data,
            select: { id: true, name: true, website: true },
        });
        return jsonResponse({ institution });
    } catch (error) {
        return prismaError(error, 'Institution');
    }
}

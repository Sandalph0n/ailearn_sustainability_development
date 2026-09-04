import { NextRequest, NextResponse } from 'next/server';

import { badId, prismaError } from '@/lib/admin/route-helpers';
import { TermSchema } from '@/lib/admin/term-schema';
import {
    guardInstitutionAction,
    guardInstitutionWrite,
} from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/terms/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.TERM_UPDATE,
        TermSchema,
        'Term',
    );
    if (!guard.ok) return guard.response;
    if (guard.data.institutionId !== institutionId) {
        return errorResponse(400, 'VALIDATION_ERROR', 'A term cannot be moved', {
            institutionId: ['A term cannot be moved to another institution'],
        });
    }

    try {
        const term = await db.studyTerm.update({
            where: { id, institutionId },
            data: guard.data,
            select: { id: true, year: true, session: true },
        });
        return jsonResponse({ term });
    } catch (error) {
        return prismaError(error, 'Term', {
            unique: 'That year and session already exists at this institution',
        });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/terms/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.TERM_DELETE,
    );
    if (!guard.ok) return guard.response;

    try {
        await db.studyTerm.delete({ where: { id, institutionId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Term', {
            inUse: 'This term has submitted student work, which cannot be deleted.',
        });
    }
}

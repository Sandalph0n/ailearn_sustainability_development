import { NextRequest, NextResponse } from 'next/server';

import {
    OfferingConfigurationError,
    validateOfferingConfiguration,
} from '@/lib/admin/offering-configuration';
import { OfferingSchema } from '@/lib/admin/offering-schema';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import {
    guardInstitutionAction,
    guardInstitutionWrite,
} from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/offerings/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.OFFERING_UPDATE,
        OfferingSchema,
        'Offering',
    );
    if (!guard.ok) return guard.response;

    const current = await db.offering.findFirst({
        where: { id, subject: { institutionId } },
        select: { id: true },
    });
    if (!current) return errorResponse(404, 'NOT_FOUND', 'Offering does not exist');

    try {
        const offering = await db.$transaction(async (tx) => {
            await validateOfferingConfiguration(tx, guard.data, id);
            const subject = await tx.subject.findUnique({
                where: { id: guard.data.subjectId },
                select: { institutionId: true },
            });
            if (subject?.institutionId !== institutionId) {
                throw new OfferingConfigurationError('Subject belongs to another institution', 'subjectId');
            }
            return tx.offering.update({
                where: { id },
                data: guard.data,
                select: { id: true, subjectId: true, termId: true },
            });
        });
        return jsonResponse({ offering });
    } catch (error) {
        if (error instanceof OfferingConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
        }
        return prismaError(error, 'Offering', {
            unique: 'This subject is already offered in that term',
        });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/offerings/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.OFFERING_DELETE,
    );
    if (!guard.ok) return guard.response;

    const current = await db.offering.findFirst({
        where: { id, subject: { institutionId } },
        select: { id: true },
    });
    if (!current) return errorResponse(404, 'NOT_FOUND', 'Offering does not exist');

    try {
        await db.offering.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Offering', {
            inUse: 'This offering has student work and cannot be deleted.',
        });
    }
}

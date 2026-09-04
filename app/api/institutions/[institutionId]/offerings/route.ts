import { NextRequest, NextResponse } from 'next/server';

import {
    OfferingConfigurationError,
    validateOfferingConfiguration,
} from '@/lib/admin/offering-configuration';
import { OfferingSchema } from '@/lib/admin/offering-schema';
import { prismaError } from '@/lib/admin/route-helpers';
import { guardInstitutionWrite } from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/offerings'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.OFFERING_CREATE,
        OfferingSchema,
        'Offering',
    );
    if (!guard.ok) return guard.response;

    try {
        const offering = await db.$transaction(async (tx) => {
            await validateOfferingConfiguration(tx, guard.data, null);
            const subject = await tx.subject.findUnique({
                where: { id: guard.data.subjectId },
                select: { institutionId: true },
            });
            if (subject?.institutionId !== institutionId) {
                throw new OfferingConfigurationError('Subject belongs to another institution', 'subjectId');
            }
            return tx.offering.create({
                data: guard.data,
                select: { id: true, subjectId: true, termId: true },
            });
        });
        return jsonResponse({ offering }, { status: 201 });
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

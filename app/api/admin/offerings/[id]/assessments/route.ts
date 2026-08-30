// Route này tạo assessment bên trong một offering.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import {
    AssessmentConfigurationError,
    syncAssessmentTools,
    validateAssessmentConfiguration,
} from '@/lib/admin/assessment-configuration';
import { AssessmentSchema } from '@/lib/admin/assessment-schema';
import { badId, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/offerings/[id]/assessments'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, AssessmentSchema, 'Assessment');
    if (!guard.ok) return guard.response;

    const { id: offeringId } = await params;
    const invalid = badId(offeringId);
    if (invalid) return invalid;

    try {
        const assessment = await db.$transaction(async (tx) => {
            await validateAssessmentConfiguration(tx, offeringId, guard.data, null);
            const { toolIds, ...assessmentData } = guard.data;
            const created = await tx.assessment.create({
                data: { ...assessmentData, offeringId },
                select: { id: true, name: true },
            });
            await syncAssessmentTools(tx, created.id, toolIds);
            return created;
        });
        return jsonResponse({ assessment }, { status: 201 });
    } catch (error) {
        if (error instanceof AssessmentConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
        }
        return prismaError(error, 'Assessment');
    }
}

import { NextRequest, NextResponse } from 'next/server';

import {
    AssessmentConfigurationError,
    syncAssessmentTools,
    validateAssessmentConfiguration,
} from '@/lib/admin/assessment-configuration';
import { AssessmentSchema } from '@/lib/admin/assessment-schema';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

import { guardAssessmentWrite } from './assessment-route-guard';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/offerings/[id]/assessments'>,
): Promise<NextResponse> {
    const { institutionId, id: offeringId } = await params;
    const invalid = badId(institutionId) ?? badId(offeringId);
    if (invalid) return invalid;

    const guard = await guardAssessmentWrite(
        request,
        institutionId,
        offeringId,
        PERMISSION_CODE.ASSESSMENT_CREATE,
        AssessmentSchema,
    );
    if (!guard.ok) return guard.response;

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

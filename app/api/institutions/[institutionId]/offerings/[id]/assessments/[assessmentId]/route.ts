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

import {
    guardAssessmentAction,
    guardAssessmentWrite,
} from '../assessment-route-guard';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    {
        params,
    }: RouteContext<'/api/institutions/[institutionId]/offerings/[id]/assessments/[assessmentId]'>,
): Promise<NextResponse> {
    const { institutionId, id: offeringId, assessmentId } = await params;
    const invalid = badId(institutionId) ?? badId(offeringId) ?? badId(assessmentId);
    if (invalid) return invalid;

    const guard = await guardAssessmentWrite(
        request,
        institutionId,
        offeringId,
        PERMISSION_CODE.ASSESSMENT_UPDATE,
        AssessmentSchema,
    );
    if (!guard.ok) return guard.response;

    try {
        const assessment = await db.$transaction(async (tx) => {
            await validateAssessmentConfiguration(
                tx,
                offeringId,
                guard.data,
                assessmentId,
            );
            const { toolIds, ...assessmentData } = guard.data;
            const updated = await tx.assessment.update({
                where: { id: assessmentId, offeringId },
                data: assessmentData,
                select: { id: true, name: true },
            });
            await syncAssessmentTools(tx, assessmentId, toolIds);
            return updated;
        });
        return jsonResponse({ assessment });
    } catch (error) {
        if (error instanceof AssessmentConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
        }
        return prismaError(error, 'Assessment');
    }
}

export async function DELETE(
    request: NextRequest,
    {
        params,
    }: RouteContext<'/api/institutions/[institutionId]/offerings/[id]/assessments/[assessmentId]'>,
): Promise<NextResponse> {
    const { institutionId, id: offeringId, assessmentId } = await params;
    const invalid = badId(institutionId) ?? badId(offeringId) ?? badId(assessmentId);
    if (invalid) return invalid;

    const guard = await guardAssessmentAction(
        request,
        institutionId,
        offeringId,
        PERMISSION_CODE.ASSESSMENT_DELETE,
    );
    if (!guard.ok) return guard.response;

    try {
        await db.assessment.delete({ where: { id: assessmentId, offeringId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Assessment', {
            inUse: 'This assessment has student attempts and cannot be deleted.',
        });
    }
}

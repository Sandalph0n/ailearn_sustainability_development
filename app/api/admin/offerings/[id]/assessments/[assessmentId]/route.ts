// Route này sửa hoặc xoá assessment, và kiểm nó thuộc offering trên URL.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import {
    AssessmentConfigurationError,
    syncAssessmentTools,
    validateAssessmentConfiguration,
} from '@/lib/admin/assessment-configuration';
import { AssessmentSchema } from '@/lib/admin/assessment-schema';
import { badId, guardDelete, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/offerings/[id]/assessments/[assessmentId]'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, AssessmentSchema, 'Assessment');
    if (!guard.ok) return guard.response;

    const { id: offeringId, assessmentId } = await params;
    const invalid = badId(offeringId) ?? badId(assessmentId);
    if (invalid) return invalid;

    try {
        const assessment = await db.$transaction(async (tx) => {
            await validateAssessmentConfiguration(tx, offeringId, guard.data, assessmentId);
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
    { params }: RouteContext<'/api/admin/offerings/[id]/assessments/[assessmentId]'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id: offeringId, assessmentId } = await params;
    const invalid = badId(offeringId) ?? badId(assessmentId);
    if (invalid) return invalid;

    try {
        await db.assessment.delete({ where: { id: assessmentId, offeringId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Assessment', {
            inUse: 'This assessment has student attempts and cannot be deleted.',
        });
    }
}

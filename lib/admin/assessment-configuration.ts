// File này giữ giới hạn tổng trọng số và kiểm tra tool của Assessment.
import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';
import type { AssessmentSchemaValue } from '@/lib/admin/assessment-schema';

export class AssessmentConfigurationError extends Error {
    constructor(
        message: string,
        readonly field: 'weight' | 'toolIds',
    ) {
        super(message);
    }
}

export async function validateAssessmentConfiguration(
    tx: Prisma.TransactionClient,
    offeringId: string,
    data: AssessmentSchemaValue,
    currentAssessmentId: string | null,
): Promise<void> {
    const offering = await tx.offering.findUnique({ where: { id: offeringId }, select: { id: true } });
    if (!offering) throw new AssessmentConfigurationError('Offering does not exist', 'weight');

    if (currentAssessmentId) {
        const current = await tx.assessment.findUnique({
            where: { id: currentAssessmentId },
            select: { offeringId: true },
        });
        if (!current || current.offeringId !== offeringId) {
            throw new AssessmentConfigurationError(
                'Assessment does not belong to this offering',
                'weight',
            );
        }
    }

    const [tools, aggregate] = await Promise.all([
        tx.tool.findMany({ where: { id: { in: data.toolIds } }, select: { id: true } }),
        tx.assessment.aggregate({
            where: {
                offeringId,
                ...(currentAssessmentId ? { id: { not: currentAssessmentId } } : {}),
            },
            _sum: { weight: true },
        }),
    ]);

    if (tools.length !== data.toolIds.length) {
        throw new AssessmentConfigurationError('One or more tools do not exist', 'toolIds');
    }

    const total = (aggregate._sum.weight ?? 0) + data.weight;
    if (total > 100 + Number.EPSILON) {
        throw new AssessmentConfigurationError(
            `Assessment weights would total ${total}%, above the 100% limit`,
            'weight',
        );
    }
}

export async function syncAssessmentTools(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    toolIds: string[],
): Promise<void> {
    await tx.assessmentAllowTool.deleteMany({ where: { assessmentId } });
    if (toolIds.length > 0) {
        await tx.assessmentAllowTool.createMany({
            data: toolIds.map((toolId) => ({ assessmentId, toolId })),
        });
    }
}

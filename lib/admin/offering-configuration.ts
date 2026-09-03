// File này giữ các luật nối nhiều bảng của Offering.
import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';
import type { OfferingSchemaValue } from '@/lib/admin/offering-schema';

export class OfferingConfigurationError extends Error {
    constructor(
        message: string,
        readonly field: 'subjectId' | 'termId',
    ) {
        super(message);
    }
}

export async function validateOfferingConfiguration(
    tx: Prisma.TransactionClient,
    data: OfferingSchemaValue,
    currentOfferingId: string | null,
): Promise<void> {
    const [subject, term] = await Promise.all([
        tx.subject.findUnique({ where: { id: data.subjectId }, select: { institutionId: true } }),
        tx.studyTerm.findUnique({ where: { id: data.termId }, select: { institutionId: true } }),
    ]);

    if (!subject) throw new OfferingConfigurationError('Subject does not exist', 'subjectId');
    if (!term) throw new OfferingConfigurationError('Term does not exist', 'termId');
    if (subject.institutionId !== term.institutionId) {
        throw new OfferingConfigurationError(
            'Subject and term must belong to the same institution',
            'termId',
        );
    }

    if (!currentOfferingId) return;

    const current = await tx.offering.findUnique({
        where: { id: currentOfferingId },
        select: {
            subjectId: true,
            termId: true,
            _count: {
                select: {
                    assessments: true,
                    scopeAssignments: true,
                    scopeAssignmentCodes: true,
                },
            },
        },
    });
    if (!current) throw new OfferingConfigurationError('Offering does not exist', 'subjectId');

    const identityChanged = current.subjectId !== data.subjectId || current.termId !== data.termId;
    const linkedRecords =
        current._count.assessments +
        current._count.scopeAssignments +
        current._count.scopeAssignmentCodes;
    if (identityChanged && linkedRecords > 0) {
        throw new OfferingConfigurationError(
            'An offering with assessments, scope assignments or codes cannot change subject or term',
            current.subjectId !== data.subjectId ? 'subjectId' : 'termId',
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@/app/generated/prisma/client';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const redeemCodeSchema = z.strictObject({
    roleAssignmentId: z.uuid({ message: 'Choose a valid role' }),
    codeId: z.uuid({ message: 'Enter a valid access code' }),
});

class CodeRedemptionError extends Error {}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();

    const session = await getCurrentSession();
    if (!session) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);

    const parsed = redeemCodeSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Access code data is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const { roleAssignmentId, codeId } = parsed.data;

    try {
        const scopeAssignment = await db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`scope-code:${codeId}`}, 0))`;

            const code = await tx.scopeAssignmentCode.findUnique({
                where: { id: codeId },
                select: {
                    offeringId: true,
                    usedAt: true,
                    offering: { select: { subject: { select: { institutionId: true } } } },
                },
            });
            if (!code || code.usedAt) {
                throw new CodeRedemptionError('The access code is invalid or has already been used');
            }

            const assignment = await tx.roleAssignment.findFirst({
                where: {
                    id: roleAssignmentId,
                    userId: session.user.id,
                    roleRevokedAt: null,
                },
                select: { role: { select: { scopeType: true, institutionId: true } } },
            });
            if (
                !assignment ||
                assignment.role.scopeType !== 'OFFERING' ||
                assignment.role.institutionId !== code.offering.subject.institutionId
            ) {
                throw new CodeRedemptionError('That role cannot use this access code');
            }

            return tx.scopeAssignment.create({
                data: {
                    roleAssignmentId,
                    offeringId: code.offeringId,
                    isAssignedDirectlyByUser: false,
                    isAssignedUsingCode: true,
                    usedCodeId: codeId,
                },
                select: { id: true, offeringId: true },
            });
        });

        return jsonResponse({ scopeAssignment }, { status: 201 });
    } catch (error) {
        if (error instanceof CodeRedemptionError) {
            return errorResponse(409, 'RESOURCE_IN_USE', error.message);
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return errorResponse(
                409,
                'RESOURCE_IN_USE',
                'This role already has access to that subject offering',
            );
        }

        console.error('Failed to redeem scope assignment code', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to redeem access code');
    }
}

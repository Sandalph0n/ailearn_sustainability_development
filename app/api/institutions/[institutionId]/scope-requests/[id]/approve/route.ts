import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

class RequestAlreadyProcessedError extends Error {}

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/scope-requests/[id]/approve'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.ROLE_REQUEST_REVIEW,
    );
    if (!guard.ok) return guard.response;

    try {
        const scopeAssignment = await db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`scope-request:${id}`}, 0))`;
            const scopeRequest = await tx.scopeAssignmentRequest.findFirst({
                where: {
                    id,
                    offering: { subject: { institutionId } },
                    roleAssignment: { role: { institutionId } },
                },
                select: { roleAssignmentId: true, offeringId: true, status: true },
            });
            if (!scopeRequest) throw new RequestAlreadyProcessedError('Request does not exist');
            if (scopeRequest.status !== 'PENDING') {
                throw new RequestAlreadyProcessedError('This request has already been processed');
            }

            const scope = await tx.scopeAssignment.create({
                data: {
                    roleAssignmentId: scopeRequest.roleAssignmentId,
                    offeringId: scopeRequest.offeringId,
                    source: 'REQUEST_APPROVED',
                },
                select: { id: true, offeringId: true },
            });
            await tx.scopeAssignmentRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    processedAt: new Date(),
                    processedByUserId: guard.session.user.id,
                    approvedScopeAssignmentId: scope.id,
                },
            });
            return scope;
        });

        return jsonResponse({ scopeAssignment });
    } catch (error) {
        if (error instanceof RequestAlreadyProcessedError) {
            return errorResponse(409, 'REQUEST_ALREADY_PROCESSED', error.message);
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return errorResponse(
                409,
                'RESOURCE_IN_USE',
                'This role already has access to that subject offering',
            );
        }
        return prismaError(error, 'Subject access request');
    }
}

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

const requestScopeSchema = z.strictObject({
    roleAssignmentId: z.uuid({ message: 'Choose a valid role' }),
    offeringId: z.uuid({ message: 'Choose a valid subject offering' }),
});

class ScopeRequestError extends Error {
    constructor(
        readonly code:
            | 'ASSIGNMENT_NOT_FOUND'
            | 'OFFERING_NOT_FOUND'
            | 'INCOMPATIBLE_SCOPE'
            | 'SCOPE_EXISTS'
            | 'REQUEST_PENDING',
        message: string,
    ) {
        super(message);
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();

    const session = await getCurrentSession();
    if (!session) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    const body = await readAuthJson(request);
    if (!body.ok) return invalidBodyResponse(body.reason);

    const parsed = requestScopeSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Subject access request is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const { roleAssignmentId, offeringId } = parsed.data;

    try {
        const scopeRequest = await db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`scope-request:${roleAssignmentId}:${offeringId}`}, 0))`;

            const [assignment, offering] = await Promise.all([
                tx.roleAssignment.findFirst({
                    where: {
                        id: roleAssignmentId,
                        userId: session.user.id,
                        roleRevokedAt: null,
                    },
                    select: {
                        role: { select: { scopeType: true, institutionId: true } },
                        scopeAssignments: {
                            where: { offeringId, revokedAt: null },
                            select: { id: true },
                        },
                        scopeRequests: {
                            where: { offeringId, status: 'PENDING' },
                            select: { id: true },
                        },
                    },
                }),
                tx.offering.findUnique({
                    where: { id: offeringId },
                    select: { subject: { select: { institutionId: true } } },
                }),
            ]);

            if (!assignment) {
                throw new ScopeRequestError(
                    'ASSIGNMENT_NOT_FOUND',
                    'That active role does not belong to you',
                );
            }
            if (!offering) {
                throw new ScopeRequestError(
                    'OFFERING_NOT_FOUND',
                    'Subject offering does not exist',
                );
            }
            if (
                assignment.role.scopeType !== 'OFFERING' ||
                assignment.role.institutionId !== offering.subject.institutionId
            ) {
                throw new ScopeRequestError(
                    'INCOMPATIBLE_SCOPE',
                    'That role cannot be used for this subject offering',
                );
            }
            if (assignment.scopeAssignments.length > 0) {
                throw new ScopeRequestError(
                    'SCOPE_EXISTS',
                    'This role already has access to that subject offering',
                );
            }
            if (assignment.scopeRequests.length > 0) {
                throw new ScopeRequestError(
                    'REQUEST_PENDING',
                    'An access request for this role and offering is already pending',
                );
            }

            return tx.scopeAssignmentRequest.create({
                data: { roleAssignmentId, offeringId },
                select: { id: true, requestedAt: true, status: true },
            });
        });

        return jsonResponse({ scopeRequest }, { status: 201 });
    } catch (error) {
        if (error instanceof ScopeRequestError) {
            const status =
                error.code === 'ASSIGNMENT_NOT_FOUND' || error.code === 'OFFERING_NOT_FOUND'
                    ? 404
                    : 409;
            const responseCode =
                error.code === 'ASSIGNMENT_NOT_FOUND' || error.code === 'OFFERING_NOT_FOUND'
                    ? 'NOT_FOUND'
                    : error.code === 'REQUEST_PENDING'
                      ? 'ROLE_REQUEST_ALREADY_PENDING'
                      : 'RESOURCE_IN_USE';
            return errorResponse(status, responseCode, error.message);
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return errorResponse(
                409,
                'ROLE_REQUEST_ALREADY_PENDING',
                'An access request for this role and offering is already pending',
            );
        }

        console.error('Failed to create subject access request', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to create subject access request');
    }
}

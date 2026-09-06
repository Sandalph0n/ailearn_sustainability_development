import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@/app/generated/prisma/client';
import { guardInstitutionWrite } from '@/lib/auth/institution-route-guard';
import { assertCanDelegateRole, DelegationPolicyError } from '@/lib/auth/delegation-policy';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

const scopeSchema = z.strictObject({ offeringId: z.uuid({ message: 'Choose an offering' }) });

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/role-assignments/[id]/scopes'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    if (!z.uuid().safeParse(id).success) return errorResponse(404, 'NOT_FOUND', 'Role assignment not found');
    const guard = await guardInstitutionWrite(request, institutionId, PERMISSION_CODE.SCOPE_ASSIGNMENT_CREATE, scopeSchema, 'Scope assignment');
    if (!guard.ok) return guard.response;

    try {
        const scope = await db.$transaction(async (tx) => {
            const [assignment, offering] = await Promise.all([
                tx.roleAssignment.findFirst({
                    where: { id, roleRevokedAt: null, role: { institutionId, scopeType: 'OFFERING' } },
                    select: { id: true, roleId: true },
                }),
                tx.offering.findFirst({
                    where: { id: guard.data.offeringId, subject: { institutionId } },
                    select: { id: true },
                }),
            ]);
            if (!assignment || !offering) throw new Error('NOT_FOUND');
            await assertCanDelegateRole(tx, institutionId, assignment.roleId, guard.context.permissions);
            return tx.scopeAssignment.create({
                data: {
                    roleAssignmentId: assignment.id,
                    offeringId: offering.id,
                    source: 'DIRECT',
                    assignedDirectlyById: guard.session.user.id,
                },
                select: { id: true, assignedAt: true },
            });
        });
        return jsonResponse({ scope: { ...scope, assignedBy: `${guard.session.user.firstName} ${guard.session.user.lastName}` } }, { status: 201 });
    } catch (error) {
        if (error instanceof DelegationPolicyError) return errorResponse(403, 'AUTHORIZATION_FORBIDDEN', error.message);
        if (error instanceof Error && error.message === 'NOT_FOUND') return errorResponse(404, 'NOT_FOUND', 'Role assignment or offering not found');
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return errorResponse(409, 'RESOURCE_IN_USE', 'This role already has that active scope');
        console.error('Failed to grant scope', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to grant scope');
    }
}

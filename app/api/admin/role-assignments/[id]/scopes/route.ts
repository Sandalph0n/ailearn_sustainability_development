import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { badId, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

const scopeSchema = z.strictObject({
    offeringId: z.uuid({ message: 'Choose an offering' }),
});

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/role-assignments/[id]/scopes'>,
): Promise<NextResponse> {
    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const guard = await guardWrite(request, scopeSchema, 'Scope assignment');
    if (!guard.ok) return guard.response;

    const assignment = await db.roleAssignment.findFirst({
        where: { id, roleRevokedAt: null, role: { scopeType: 'OFFERING' } },
        select: { id: true, role: { select: { institutionId: true } } },
    });
    if (!assignment) {
        return errorResponse(404, 'NOT_FOUND', 'Active offering role assignment not found');
    }

    const offering = await db.offering.findFirst({
        where: {
            id: guard.data.offeringId,
            subject: { institutionId: assignment.role.institutionId },
        },
        select: { id: true },
    });
    if (!offering) {
        return errorResponse(404, 'NOT_FOUND', 'Offering does not belong to this institution');
    }

    try {
        const scope = await db.scopeAssignment.create({
            data: {
                roleAssignmentId: assignment.id,
                offeringId: offering.id,
                source: 'DIRECT',
                assignedDirectlyById: guard.session.user.id,
            },
            select: { id: true, assignedAt: true },
        });
        return jsonResponse(
            {
                scope: {
                    ...scope,
                    assignedBy: `${guard.session.user.firstName} ${guard.session.user.lastName}`,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        return prismaError(error, 'Scope assignment', {
            unique: 'This role already has that active offering scope',
        });
    }
}

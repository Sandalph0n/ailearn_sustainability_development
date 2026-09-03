// Route này cấp một role mới, còn thu hồi dùng endpoint riêng để giữ lịch sử.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import {
    RoleAssignmentConfigurationError,
    validateRoleAssignment,
} from '@/lib/admin/role-assignment-configuration';
import { RoleAssignmentSchema } from '@/lib/admin/role-assignment-schema';
import { guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardWrite(request, RoleAssignmentSchema, 'Role assignment');
    if (!guard.ok) return guard.response;

    try {
        const assignment = await db.$transaction(async (tx) => {
            await validateRoleAssignment(tx, guard.data);
            const { offeringId, ...assignmentData } = guard.data;
            return tx.roleAssignment.create({
                data: {
                    ...assignmentData,
                    grantDirectlyById: guard.session.user.id,
                    ...(offeringId
                        ? {
                              scopeAssignments: {
                                  create: {
                                      offeringId,
                                      isAssignedDirectlyByUser: true,
                                      isAssignedUsingCode: false,
                                      assignedDirectlyById: guard.session.user.id,
                                  },
                              },
                          }
                        : {}),
                },
                select: { id: true, roleGrantedAt: true },
            });
        });
        return jsonResponse({ assignment }, { status: 201 });
    } catch (error) {
        if (error instanceof RoleAssignmentConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
        }
        return prismaError(error, 'Role assignment', {
            unique: 'This user already holds that role',
        });
    }
}

import { NextRequest, NextResponse } from 'next/server';

import { prismaError } from '@/lib/admin/route-helpers';
import { ScopeCodeSchema } from '@/lib/admin/scope-code-schema';
import {
    guardInstitutionAction,
    guardInstitutionWrite,
} from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/scope-codes'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_VIEW,
    );
    if (!guard.ok) return guard.response;

    const codes = await db.scopeAssignmentCode.findMany({
        where: { offering: { subject: { institutionId } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
            id: true,
            createdAt: true,
            usedAt: true,
            revokedAt: true,
            offering: {
                select: {
                    id: true,
                    subject: { select: { subjectCode: true, subjectName: true } },
                    term: { select: { year: true, session: true } },
                },
            },
            createdBy: { select: { firstName: true, lastName: true, email: true } },
            usedFor: {
                select: {
                    roleAssignment: {
                        select: {
                            user: { select: { firstName: true, lastName: true, email: true } },
                            role: { select: { roleName: true } },
                        },
                    },
                },
            },
        },
    });

    return jsonResponse({ codes });
}

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/scope-codes'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_CREATE,
        ScopeCodeSchema,
        'Access code',
    );
    if (!guard.ok) return guard.response;

    const offering = await db.offering.findFirst({
        where: { id: guard.data.offeringId, subject: { institutionId } },
        select: { id: true },
    });
    if (!offering) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Offering belongs to another institution', {
            offeringId: ['Choose an offering from the active institution'],
        });
    }

    try {
        const code = await db.scopeAssignmentCode.create({
            data: {
                offeringId: offering.id,
                createdById: guard.session.user.id,
            },
            select: { id: true, offeringId: true, createdAt: true },
        });
        return jsonResponse({ code }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Access code');
    }
}

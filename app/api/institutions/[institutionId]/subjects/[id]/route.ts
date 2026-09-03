import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import {
    guardInstitutionAction,
    guardInstitutionWrite,
} from '@/lib/auth/institution-route-guard';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import { SubjectSchema } from '@/lib/admin/subject-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/subjects/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.SUBJECT_UPDATE,
        SubjectSchema,
        'Subject',
    );
    if (!guard.ok) return guard.response;

    if (guard.data.institutionId !== institutionId) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'A subject cannot be moved outside the active institution',
            { institutionId: ['Use the institution from your active role'] },
        );
    }

    try {
        const current = await db.subject.findUnique({
            where: { id },
            select: { institutionId: true },
        });
        if (!current || current.institutionId !== institutionId) {
            return errorResponse(404, 'NOT_FOUND', 'Subject does not exist');
        }

        const subject = await db.subject.update({
            where: { id },
            data: guard.data,
            select: { id: true, subjectCode: true, subjectName: true },
        });
        return jsonResponse({ subject });
    } catch (error) {
        return prismaError(error, 'Subject', {
            unique: 'That subject code is already used at this institution',
        });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/subjects/[id]'>,
): Promise<NextResponse> {
    const { institutionId, id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.SUBJECT_DELETE,
    );
    if (!guard.ok) return guard.response;

    try {
        const current = await db.subject.findUnique({
            where: { id },
            select: { institutionId: true },
        });
        if (!current || current.institutionId !== institutionId) {
            return errorResponse(404, 'NOT_FOUND', 'Subject does not exist');
        }

        await db.subject.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Subject', {
            inUse: 'This subject has submitted student work, which cannot be deleted.',
        });
    }
}

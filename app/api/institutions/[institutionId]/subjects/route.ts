import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { guardInstitutionWrite } from '@/lib/auth/institution-route-guard';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { prismaError } from '@/lib/admin/route-helpers';
import { SubjectSchema } from '@/lib/admin/subject-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/subjects'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.SUBJECT_CREATE,
        SubjectSchema,
        'Subject',
    );
    if (!guard.ok) return guard.response;

    if (guard.data.institutionId !== institutionId) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'The subject must belong to the active institution',
            { institutionId: ['Use the institution from your active role'] },
        );
    }

    try {
        const subject = await db.subject.create({
            data: guard.data,
            select: { id: true, subjectCode: true, subjectName: true },
        });
        return jsonResponse({ subject }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Subject', {
            unique: 'That subject code is already used at this institution',
        });
    }
}

import { NextRequest, NextResponse } from 'next/server';

import { TermSchema } from '@/lib/admin/term-schema';
import { prismaError } from '@/lib/admin/route-helpers';
import { guardInstitutionWrite } from '@/lib/auth/institution-route-guard';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/terms'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionWrite(
        request,
        institutionId,
        PERMISSION_CODE.TERM_CREATE,
        TermSchema,
        'Term',
    );
    if (!guard.ok) return guard.response;
    if (guard.data.institutionId !== institutionId) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Use the active institution', {
            institutionId: ['Use the active institution'],
        });
    }

    try {
        const term = await db.studyTerm.create({
            data: guard.data,
            select: { id: true, year: true, session: true },
        });
        return jsonResponse({ term }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Term', {
            unique: 'That year and session already exists at this institution',
        });
    }
}

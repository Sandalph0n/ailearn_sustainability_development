// Route này sửa và xoá một môn học.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { badId, guardDelete, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { SubjectSchema } from '@/lib/admin/subject-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/subjects/[id]'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, SubjectSchema, 'Subject');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        const current = await db.subject.findUnique({
            where: { id },
            select: { institutionId: true },
        });
        if (!current) return errorResponse(404, 'NOT_FOUND', 'Subject does not exist');
        if (current.institutionId !== guard.data.institutionId) {
            return errorResponse(
                400,
                'VALIDATION_ERROR',
                'A subject cannot be moved to another institution',
                { institutionId: ['A subject cannot be moved to another institution'] },
            );
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

/**
 * Xoá một môn học.
 *
 * `Offering` cascade theo `Subject`, và chuỗi đó chảy tiếp xuống `Assessment`. Nhưng
 * `AssessmentAttempt` gắn `Restrict`, nên môn nào đã có sinh viên nộp bài thì database chặn và
 * cả phép xoá bị huỷ.
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/subjects/[id]'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        await db.subject.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Subject', {
            inUse: 'This subject has submitted student work, which cannot be deleted.',
        });
    }
}

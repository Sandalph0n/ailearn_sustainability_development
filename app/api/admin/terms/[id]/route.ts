// Route này sửa và xoá một kỳ học.
import { NextRequest, NextResponse } from 'next/server';

import { jsonResponse } from '@/lib/auth/http/response';
import { badId, guardDelete, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { TermSchema } from '@/lib/admin/term-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/terms/[id]'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, TermSchema, 'Term');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        const term = await db.studyTerm.update({
            where: { id },
            data: guard.data,
            select: { id: true, year: true, session: true },
        });
        return jsonResponse({ term });
    } catch (error) {
        return prismaError(error, 'Term', {
            unique: 'That year and session already exists at this institution',
        });
    }
}

/**
 * Xoá một kỳ học.
 *
 * `StudyTermPeriod` và `Offering` đều cascade theo, và chuỗi chảy tiếp xuống `Assessment`. Kỳ
 * nào đã có bài nộp thì `AssessmentAttempt` chặn bằng `Restrict` và cả phép xoá bị huỷ.
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/terms/[id]'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        await db.studyTerm.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Term', {
            inUse: 'This term has submitted student work, which cannot be deleted.',
        });
    }
}

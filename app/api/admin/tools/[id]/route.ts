// Route này sửa và xoá một công cụ.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { badId, guardDelete, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { ToolSchema } from '@/lib/admin/tool-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/tools/[id]'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, ToolSchema, 'Tool');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        const current = await db.tool.findUnique({ where: { id }, select: { code: true } });
        if (!current) return errorResponse(404, 'NOT_FOUND', 'Tool does not exist');
        if (current.code !== guard.data.code) {
            return errorResponse(
                400,
                'VALIDATION_ERROR',
                'Tool code cannot change after creation',
                { code: ['Tool code cannot change after creation'] },
            );
        }

        const tool = await db.tool.update({
            where: { id },
            data: guard.data,
            select: { id: true, code: true, name: true },
        });
        return jsonResponse({ tool });
    } catch (error) {
        return prismaError(error, 'Tool', { unique: 'A tool with that code already exists' });
    }
}

/**
 * Xoá một công cụ.
 *
 * `AssessmentAllowTool` và `AssignmentWorkSession` đều trỏ tới `Tool` bằng `Restrict`. Nên công
 * cụ đã từng được giao cho một bài tập, hoặc đã có ai mở một phiên làm việc bằng nó, thì KHÔNG
 * xoá được — database chặn và route dịch thành 409.
 *
 * Đó là hành vi đúng: phiên làm việc là bằng chứng, và nó vô nghĩa nếu công cụ sinh ra nó biến mất.
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/tools/[id]'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        await db.tool.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Tool', {
            inUse: 'This tool has been used in assessments or work sessions, so it cannot be deleted.',
        });
    }
}

// Route này tạo công cụ mới.
import { NextRequest, NextResponse } from 'next/server';

import { jsonResponse } from '@/lib/auth/http/response';
import { guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { ToolSchema } from '@/lib/admin/tool-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Không có `GET`: danh sách do `app/admin/tools/page.tsx` đọc thẳng từ database trong Server
 * Component. Thêm một endpoint đọc nữa chỉ để server tự gọi lại chính mình là thừa một vòng mạng
 * và thừa một chỗ phải nhớ kiểm quyền.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardWrite(request, ToolSchema, 'Tool');
    if (!guard.ok) return guard.response;

    try {
        const tool = await db.tool.create({
            data: guard.data,
            select: { id: true, code: true, name: true },
        });
        return jsonResponse({ tool }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Tool', { unique: 'A tool with that code already exists' });
    }
}

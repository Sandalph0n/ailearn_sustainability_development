// Route này tạo cơ sở giáo dục mới.
import { NextRequest, NextResponse } from 'next/server';

import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
    jsonResponse,
} from '@/lib/auth/http/response';
import { requireSystemAdmin } from '@/lib/auth/require-admin';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { InstitutionSchema } from '@/lib/admin/institution-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Tạo một cơ sở giáo dục.
 *
 * Không có `GET` ở đây: danh sách do `app/admin/institutions/page.tsx` đọc thẳng từ database
 * trong Server Component. Thêm một endpoint đọc nữa chỉ để trang tự gọi lại chính server mình
 * là thừa một vòng mạng và thừa một chỗ phải nhớ kiểm quyền.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    // Kiểm quyền TRƯỚC khi đọc body: người không có quyền không đáng để ta tốn công đọc gì thêm.
    const guard = await requireSystemAdmin();
    if (!guard.ok) {
        return guard.response;
    }

    const body = await readAuthJson(request);
    if (!body.ok) {
        return invalidBodyResponse(body.reason);
    }

    const parsed = InstitutionSchema.safeParse(body.value);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Institution data is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    const institution = await db.institution.create({
        data: parsed.data,
        select: { id: true, name: true, website: true },
    });

    return jsonResponse({ institution }, { status: 201 });
}

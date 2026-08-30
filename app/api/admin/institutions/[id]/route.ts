// Route này sửa và xoá một cơ sở giáo dục.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@/app/generated/prisma/client';
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
 * `id` lấy từ URL nên có thể là bất cứ chuỗi gì.
 *
 * Kiểm định dạng TRƯỚC khi chạm database: cột là `uuid`, nên một chuỗi không phải UUID khiến
 * Postgres ném lỗi cú pháp (`invalid input syntax for type uuid`) chứ không phải "không tìm
 * thấy" — và lỗi đó nổi lên thành 500. Về mặt ý nghĩa thì id sai định dạng đơn giản là không
 * khớp bản ghi nào, nên 404 mới đúng.
 */
const idSchema = z.uuid();

/** Prisma báo "không tìm thấy bản ghi để thao tác" bằng mã này. */
const RECORD_NOT_FOUND = 'P2025';
/** Vi phạm khoá ngoại — ở đây nghĩa là một ràng buộc `Restrict` đã chặn phép xoá dây chuyền. */
const FOREIGN_KEY_VIOLATION = 'P2003';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/institutions/[id]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

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

    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
        return errorResponse(404, 'NOT_FOUND', 'Institution does not exist');
    }

    try {
        const institution = await db.institution.update({
            where: { id },
            data: parsed.data,
            select: { id: true, name: true, website: true },
        });

        return jsonResponse({ institution });
    } catch (error) {
        if (isPrismaError(error, RECORD_NOT_FOUND)) {
            return errorResponse(404, 'NOT_FOUND', 'Institution does not exist');
        }

        console.error('Failed to update institution', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to update institution');
    }
}

/**
 * Xoá một cơ sở giáo dục.
 *
 * ─── Phép xoá này lan RẤT xa ─────────────────────────────────────────────────
 *
 * `Role`, `StudyTerm`, `Subject` cascade xuống `Offering` rồi `Assessment`. RoleRequest và
 * RoleAssignment là lịch sử nên dùng `Restrict`.
 *
 * Nhưng `AssessmentAttempt` gắn với `Assessment` bằng `Restrict`. Nên một cơ sở đã có sinh viên
 * nộp bài thì KHÔNG xoá được — database chặn giữa chừng, và cả phép xoá bị huỷ.
 *
 * Đó là hành vi đúng, không phải lỗi: bài đã nộp là bằng chứng học thuật, xoá được nó là mở một
 * đường xoá sạch dấu vết. Việc của route này chỉ là dịch lỗi database sang câu tiếng người.
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/institutions/[id]'>,
): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const guard = await requireSystemAdmin();
    if (!guard.ok) {
        return guard.response;
    }

    const { id } = await params;
    if (!idSchema.safeParse(id).success) {
        return errorResponse(404, 'NOT_FOUND', 'Institution does not exist');
    }

    try {
        await db.institution.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (isPrismaError(error, RECORD_NOT_FOUND)) {
            return errorResponse(404, 'NOT_FOUND', 'Institution does not exist');
        }

        if (isPrismaError(error, FOREIGN_KEY_VIOLATION)) {
            return errorResponse(
                409,
                'RESOURCE_IN_USE',
                'This institution has submitted work, role assignments or join-request history and cannot be deleted.',
            );
        }

        console.error('Failed to delete institution', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to delete institution');
    }
}

function isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

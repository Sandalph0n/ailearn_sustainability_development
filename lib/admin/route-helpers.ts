// File này gói phần lặp lại của mọi route ghi dữ liệu dưới `/api/admin/`.
import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@/app/generated/prisma/client';
import { isSameOriginRequest, readAuthJson } from '@/lib/auth/http/request';
import {
    errorResponse,
    invalidBodyResponse,
    invalidOriginResponse,
} from '@/lib/auth/http/response';
import { requireSystemAdmin } from '@/lib/auth/require-admin';
import type { AuthSession } from '@/lib/auth/session/service';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';

/** Prisma báo "không tìm thấy bản ghi để thao tác". */
export const RECORD_NOT_FOUND = 'P2025';
/** Vi phạm ràng buộc duy nhất. */
export const UNIQUE_VIOLATION = 'P2002';
/** Vi phạm khoá ngoại — thường là một `Restrict` đã chặn phép xoá. */
export const FOREIGN_KEY_VIOLATION = 'P2003';

const uuidSchema = z.uuid();

/**
 * Ba chốt chặn mà MỌI route ghi đều phải đi qua, theo đúng thứ tự rẻ-trước-đắt-sau.
 *
 *   1. same-origin  chỉ đọc header
 *   2. quyền admin  một truy vấn phiên
 *   3. thân request đọc tối đa 16KB rồi kiểm bằng Zod
 *
 * Trả về kết quả có nhãn thay vì ném lỗi: chỗ gọi buộc phải xử lý nhánh thất bại, quên là
 * TypeScript kêu.
 */
export async function guardWrite<TOutput>(
    request: NextRequest,
    schema: z.ZodType<TOutput>,
    entityName: string,
): Promise<
    { ok: true; data: TOutput; session: AuthSession } | { ok: false; response: NextResponse }
> {
    if (!isSameOriginRequest(request)) {
        return { ok: false, response: invalidOriginResponse() };
    }

    // Kiểm quyền TRƯỚC khi đọc thân request: người không có quyền không đáng để tốn công đọc.
    const guard = await requireSystemAdmin();
    if (!guard.ok) {
        return { ok: false, response: guard.response };
    }

    const body = await readAuthJson(request);
    if (!body.ok) {
        return { ok: false, response: invalidBodyResponse(body.reason) };
    }

    const parsed = schema.safeParse(body.value);
    if (!parsed.success) {
        return {
            ok: false,
            response: errorResponse(
                400,
                'VALIDATION_ERROR',
                `${entityName} data is invalid`,
                formatValidationErrors(parsed.error),
            ),
        };
    }

    return { ok: true, data: parsed.data, session: guard.session };
}

/** Như `guardWrite` nhưng không có thân request — dùng cho `DELETE`. */
export async function guardDelete(
    request: NextRequest,
): Promise<{ ok: true; session: AuthSession } | { ok: false; response: NextResponse }> {
    if (!isSameOriginRequest(request)) {
        return { ok: false, response: invalidOriginResponse() };
    }

    const guard = await requireSystemAdmin();
    if (!guard.ok) {
        return { ok: false, response: guard.response };
    }

    return { ok: true, session: guard.session };
}

/**
 * `id` lấy từ URL nên có thể là chuỗi bất kỳ.
 *
 * Cột là `uuid`, và một chuỗi sai định dạng khiến Postgres ném lỗi cú pháp chứ không phải "không
 * tìm thấy" — lỗi đó nổi lên thành 500. Về mặt ý nghĩa thì id sai định dạng đơn giản là không
 * khớp bản ghi nào, nên 404 mới đúng.
 */
export function badId(id: string): NextResponse | null {
    return uuidSchema.safeParse(id).success
        ? null
        : errorResponse(404, 'NOT_FOUND', 'Not found');
}

/**
 * Dịch lỗi Prisma sang phản hồi HTTP có nghĩa.
 *
 * KHÔNG trả nguyên văn lỗi database ra ngoài: chúng hay lộ tên bảng, tên cột và cả câu truy vấn.
 * Log đầy đủ ở server, nói vừa đủ với client.
 */
export function prismaError(
    error: unknown,
    entityName: string,
    messages: { unique?: string; inUse?: string } = {},
): NextResponse {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === RECORD_NOT_FOUND) {
            return errorResponse(404, 'NOT_FOUND', `${entityName} does not exist`);
        }

        if (error.code === UNIQUE_VIOLATION) {
            return errorResponse(
                409,
                'NAME_ALREADY_EXISTS',
                messages.unique ?? `That ${entityName.toLowerCase()} already exists`,
            );
        }

        if (error.code === FOREIGN_KEY_VIOLATION) {
            return errorResponse(
                409,
                'RESOURCE_IN_USE',
                messages.inUse ??
                    `This ${entityName.toLowerCase()} is still in use and cannot be deleted`,
            );
        }
    }

    console.error(`Failed to write ${entityName}`, error);
    return errorResponse(500, 'INTERNAL_ERROR', `Failed to save ${entityName.toLowerCase()}`);
}

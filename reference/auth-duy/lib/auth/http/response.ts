// File này chuẩn hóa cấu trúc JSON thành công và lỗi trả về từ auth API.
import type { ValidationErrors } from '@/lib/auth/validation/credentials';

type ErrorCode =
    | 'AUTHENTICATION_REQUIRED'
    | 'EMAIL_ALREADY_EXISTS'
    | 'INTERNAL_ERROR'
    | 'INVALID_CREDENTIALS'
    | 'INVALID_INSTITUTION'
    | 'INVALID_JSON'
    | 'INVALID_ORIGIN'
    | 'PAYLOAD_TOO_LARGE'
    | 'UNSUPPORTED_CONTENT_TYPE'
    | 'VALIDATION_ERROR';

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    const headers = new Headers(init.headers);
    headers.set('Cache-Control', 'no-store');

    return Response.json(body, { ...init, headers });
}

export function errorResponse(
    status: number,
    code: ErrorCode,
    message: string,
    fields?: ValidationErrors,
): NextResponse {
    return jsonResponse(
        {
            error: {
                code,
                message,
                ...(fields ? { fields } : {}),
            },
        },
        { status },
    );
}

export function invalidBodyResponse(reason: 'invalid_json' | 'too_large' | 'wrong_content_type'): Response {
    if (reason === 'too_large') {
        return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request payload is too large');
    }

    if (reason === 'wrong_content_type') {
        return errorResponse(415, 'UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json');
    }

    return errorResponse(400, 'INVALID_JSON', 'JSON payload is invalid');
}

export function invalidOriginResponse(): Response {
    return errorResponse(403, 'INVALID_ORIGIN', 'Request origin is invalid');
}

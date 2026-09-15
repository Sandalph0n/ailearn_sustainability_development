import type { ValidationErrors } from '@/lib/auth/validation/credentials';
import { NextResponse } from 'next/server';

export type ErrorCode =
    | 'AUTHENTICATION_REQUIRED'
    | 'AUTHORIZATION_FORBIDDEN'
    | 'EMAIL_ALREADY_EXISTS'
    | 'EVENT_SEQUENCE_CONFLICT'
    | 'IDEMPOTENCY_CONFLICT'
    | 'INTERNAL_ERROR'
    | 'INVALID_CREDENTIALS'
    | 'INVALID_INSTITUTION'
    | 'INVALID_JSON'
    | 'INVALID_ORIGIN'
    | 'NAME_ALREADY_EXISTS'
    | 'NOT_FOUND'
    | 'PAYLOAD_TOO_LARGE'
    | 'PRECONDITION_FAILED'
    | 'PRECONDITION_REQUIRED'
    | 'RESOURCE_IN_USE'
    | 'REQUEST_ALREADY_PROCESSED'
    | 'ROLE_ALREADY_ASSIGNED'
    | 'ROLE_REQUEST_ALREADY_PENDING'
    | 'UNSUPPORTED_CONTENT_TYPE'
    | 'UPSTREAM_UNAVAILABLE'
    | 'VALIDATION_ERROR'
    | 'TOOL_VERSION_MISMATCH';

export function jsonResponse(body: unknown, init: ResponseInit = {}): NextResponse {
    const headers = new Headers(init.headers);
    headers.set('Cache-Control', 'no-store');

    return NextResponse.json(body, { ...init, headers });
}

export function errorResponse(
    status: number,
    code: ErrorCode,
    message: string,
    fields?: ValidationErrors,
    details?: Record<string, unknown>,
): NextResponse {
    // Đi qua `jsonResponse` chứ không gọi thẳng `NextResponse.json`, nếu không thì mất
    // `Cache-Control: no-store` và phản hồi lỗi đăng nhập có thể bị proxy đem dùng lại.
    return jsonResponse(
        {
            error: {
                code,
                message,
                ...(fields ? { fields } : {}),
                ...(details ? { details } : {}),
            },
        },
        { status },
    );
}

export function invalidBodyResponse(reason: 'invalid_json' | 'too_large' | 'wrong_content_type'): NextResponse {
    if (reason === 'too_large') {
        return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request payload is too large');
    }

    if (reason === 'wrong_content_type') {
        return errorResponse(415, 'UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json');
    }

    return errorResponse(400, 'INVALID_JSON', 'JSON payload is invalid');
}

export function invalidOriginResponse(): NextResponse {
    return errorResponse(403, 'INVALID_ORIGIN', 'Request origin is invalid');
}

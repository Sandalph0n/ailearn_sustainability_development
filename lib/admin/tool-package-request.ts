import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth/http/request';
import { errorResponse, invalidOriginResponse } from '@/lib/auth/http/response';
import { requireSystemAdmin } from '@/lib/auth/require-admin';
import type { AuthSession } from '@/lib/auth/session/service';
import { MAX_TOOL_PACKAGE_BYTES } from '@/lib/tools/package';

const MAX_MULTIPART_BYTES = MAX_TOOL_PACKAGE_BYTES + 1024 * 1024;

export async function guardToolPackageRequest(
    request: NextRequest,
): Promise<
    { ok: true; formData: FormData; session: AuthSession } | { ok: false; response: NextResponse }
> {
    if (!isSameOriginRequest(request)) {
        return { ok: false, response: invalidOriginResponse() };
    }

    const admin = await requireSystemAdmin();
    if (!admin.ok) return admin;

    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.startsWith('multipart/form-data;')) {
        return {
            ok: false,
            response: errorResponse(
                415,
                'UNSUPPORTED_CONTENT_TYPE',
                'Content-Type must be multipart/form-data',
            ),
        };
    }

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
        return {
            ok: false,
            response: errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Tool package is too large'),
        };
    }

    try {
        return { ok: true, formData: await request.formData(), session: admin.session };
    } catch {
        return {
            ok: false,
            response: errorResponse(400, 'INVALID_JSON', 'Multipart form data is invalid'),
        };
    }
}

export function packageFileFrom(formData: FormData):
    | { ok: true; file: File }
    | { ok: false; response: NextResponse } {
    const file = formData.get('package');
    if (!(file instanceof File) || file.size === 0) {
        return {
            ok: false,
            response: errorResponse(400, 'VALIDATION_ERROR', 'A ZIP package is required', {
                package: ['Choose a non-empty ZIP package'],
            }),
        };
    }
    if (file.size > MAX_TOOL_PACKAGE_BYTES) {
        return {
            ok: false,
            response: errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Tool package exceeds 25 MB', {
                package: ['Package must be 25 MB or smaller'],
            }),
        };
    }
    return { ok: true, file };
}

export function packageValidationResponse(message: string): NextResponse {
    return errorResponse(400, 'VALIDATION_ERROR', 'Tool package is invalid', {
        package: [message],
    });
}

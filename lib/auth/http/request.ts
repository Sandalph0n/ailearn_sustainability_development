// File này đọc JSON cho auth API, giới hạn kích thước body và kiểm tra same-origin.
const MAX_AUTH_BODY_BYTES = 16 * 1024;

export type JsonBodyResult =
    | { ok: true; value: unknown }
    | { ok: false; reason: 'invalid_json' | 'too_large' | 'wrong_content_type' };

export async function readAuthJson(request: Request): Promise<JsonBodyResult> {
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
        return { ok: false, reason: 'wrong_content_type' };
    }

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_BODY_BYTES) {
        return { ok: false, reason: 'too_large' };
    }

    try {
        const body = await request.text();
        if (new TextEncoder().encode(body).byteLength > MAX_AUTH_BODY_BYTES) {
            return { ok: false, reason: 'too_large' };
        }

        return { ok: true, value: JSON.parse(body) };
    } catch {
        return { ok: false, reason: 'invalid_json' };
    }
}

function firstHeaderValue(value: string | null): string | null {
    return value?.split(',', 1)[0].trim() || null;
}

export function isSameOriginRequest(request: Request): boolean {
    if (request.headers.get('sec-fetch-site')?.toLowerCase() === 'cross-site') {
        return false;
    }

    const origin = request.headers.get('origin');
    if (!origin) {
        // Client ngoài trình duyệt không luôn gửi Origin. Trình duyệt gửi header này cho POST và không cho JS giả mạo.
        return true;
    }

    try {
        const requestUrl = new URL(request.url);
        const expectedHost =
            firstHeaderValue(request.headers.get('host')) ??
            firstHeaderValue(request.headers.get('x-forwarded-host')) ??
            requestUrl.host;
        const expectedProtocol =
            firstHeaderValue(request.headers.get('x-forwarded-proto')) ?? requestUrl.protocol.replace(':', '');
        const requestOrigin = new URL(origin);

        return requestOrigin.host === expectedHost && requestOrigin.protocol === `${expectedProtocol}:`;
    } catch {
        return false;
    }
}

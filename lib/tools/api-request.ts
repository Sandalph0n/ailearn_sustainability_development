import 'server-only';

import type { NextRequest } from 'next/server';

export type ToolJsonBodyResult =
    | { ok: true; value: unknown }
    | { ok: false; reason: 'invalid_json' | 'too_large' | 'wrong_content_type' };

/** Read a bounded JSON body. Tool event batches are intentionally allowed to exceed auth forms. */
export async function readToolJson(
    request: NextRequest,
    maxBytes: number,
): Promise<ToolJsonBodyResult> {
    const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') return { ok: false, reason: 'wrong_content_type' };

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        return { ok: false, reason: 'too_large' };
    }

    try {
        const text = await request.text();
        if (new TextEncoder().encode(text).byteLength > maxBytes) {
            return { ok: false, reason: 'too_large' };
        }
        return { ok: true, value: JSON.parse(text) };
    } catch {
        return { ok: false, reason: 'invalid_json' };
    }
}

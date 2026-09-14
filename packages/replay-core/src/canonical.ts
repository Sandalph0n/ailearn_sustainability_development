const encoder = new TextEncoder();

/** Stable JSON is required because PostgreSQL JSONB does not preserve object key order. */
export function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
        .sort()
        .filter((key) => object[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
        .join(',')}}`;
}

export async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function replayPayloadHash(input: {
    sessionId: string;
    clientBatchId: string;
    seqStart: number;
    seqEnd: number;
    clientAt: string;
    events: unknown[];
}): Promise<string> {
    return sha256Hex(canonicalJson(input));
}

export async function replayChainHash(
    previousChainHash: string | null,
    payloadHash: string,
): Promise<string> {
    return sha256Hex(canonicalJson({ previousChainHash, payloadHash }));
}

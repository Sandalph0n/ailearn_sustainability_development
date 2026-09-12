import 'server-only';

const DEVELOPMENT_TOOL_RUNTIME_ORIGIN = 'http://127.0.0.1:3000';

/** The isolated browser origin that serves uploaded tool applications. */
export function toolRuntimeOrigin(): string {
    const configured = process.env.TOOL_RUNTIME_ORIGIN?.trim();
    if (!configured && process.env.NODE_ENV === 'production') {
        throw new Error('TOOL_RUNTIME_ORIGIN is required in production');
    }

    const value = configured || DEVELOPMENT_TOOL_RUNTIME_ORIGIN;
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('TOOL_RUNTIME_ORIGIN must be an HTTP(S) origin');
    }
    if (url.pathname !== '/' || url.search || url.hash) {
        throw new Error('TOOL_RUNTIME_ORIGIN must not contain a path, query, or fragment');
    }
    return url.origin;
}

function firstHeaderValue(value: string | null): string | null {
    return value?.split(',', 1)[0].trim().toLowerCase() || null;
}

/** Next dev normalizes nextUrl.origin; Host remains authoritative for virtual-host routing. */
export function isToolRuntimeRequest(request: Request): boolean {
    const expectedHost = new URL(toolRuntimeOrigin()).host.toLowerCase();
    const actualHost =
        firstHeaderValue(request.headers.get('x-forwarded-host')) ??
        firstHeaderValue(request.headers.get('host'));
    return actualHost === expectedHost;
}

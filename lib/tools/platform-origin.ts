import 'server-only';

const DEVELOPMENT_PLATFORM_ORIGIN = 'http://localhost:3000';

/** The trusted Lernumi application origin that hosts authenticated platform pages. */
export function platformOrigin(): string {
    const configured = process.env.PLATFORM_ORIGIN?.trim();
    if (!configured && process.env.NODE_ENV === 'production') {
        throw new Error('PLATFORM_ORIGIN is required in production');
    }

    const value = configured || DEVELOPMENT_PLATFORM_ORIGIN;
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('PLATFORM_ORIGIN must be an HTTP(S) origin');
    }
    if (url.pathname !== '/' || url.search || url.hash) {
        throw new Error('PLATFORM_ORIGIN must not contain a path, query, or fragment');
    }
    return url.origin;
}

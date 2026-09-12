import 'server-only';

import { toolRuntimeOrigin } from './runtime-origin';

/** Hand the scoped JWT to the isolated tool host without exposing it in an HTTP request URL. */
export function buildToolRuntimeUrl(token: string): string {
    const url = new URL('/tool-runtime/bootstrap', toolRuntimeOrigin());
    url.hash = new URLSearchParams({ lernumi_token: token, lernumi_api: 'v1' }).toString();

    // Fragments are visible to the bootstrap page but never reach HTTP logs or Referer headers.
    return url.toString();
}

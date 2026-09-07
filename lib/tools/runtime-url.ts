import 'server-only';

/** Build the version-pinned entry URL and hand the scoped JWT to the runtime without sending it. */
export function buildToolRuntimeUrl(
    toolCode: string,
    toolVersionId: string,
    entryPath: string,
    token: string,
): string {
    const encodedEntry = entryPath.split('/').map(encodeURIComponent).join('/');
    const path = `/tools/${encodeURIComponent(toolCode)}/${encodeURIComponent(toolVersionId)}/${encodedEntry}`;
    const fragment = new URLSearchParams({ ailearn_token: token, ailearn_api: 'v1' });

    // Fragments are visible to the loaded app but are never sent in the HTTP request, server logs,
    // or Referer headers. The runtime consumes this once and clears it from browser history.
    return `${path}#${fragment.toString()}`;
}

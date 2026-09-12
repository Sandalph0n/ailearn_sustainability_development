export function normalizePath(value: string): string {
    const parts = value.replaceAll('\\', '/').split('/').filter(Boolean);
    if (parts.some((part) => part === '.' || part === '..')) {
        throw new Error(`Workspace path traversal is not allowed: ${value}`);
    }
    return parts.length ? `/${parts.join('/')}` : '/';
}

export function splitPath(value: string): { parentPath: string; name: string } {
    const path = normalizePath(value);
    const splitAt = path.lastIndexOf('/');
    return {
        parentPath: splitAt <= 0 ? '/' : path.slice(0, splitAt),
        name: path.slice(splitAt + 1),
    };
}


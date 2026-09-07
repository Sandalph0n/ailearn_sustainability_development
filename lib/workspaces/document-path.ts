const MAX_PATH_LENGTH = 512;

/** Normalize display-only paths before they can ever reach a real filesystem. */
export function normalizeDocumentPath(input: string): string | null {
    const normalized = input
        .trim()
        .replaceAll('\\', '/')
        .replace(/^\.\//, '')
        .replace(/\/{2,}/g, '/');

    if (!normalized || normalized.length > MAX_PATH_LENGTH || normalized.startsWith('/')) {
        return null;
    }

    const segments = normalized.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        return null;
    }

    return normalized;
}

export function documentParentPath(displayPath: string): string {
    const separator = displayPath.lastIndexOf('/');
    return separator === -1 ? '' : displayPath.slice(0, separator);
}

export function documentBaseName(displayPath: string): string {
    return displayPath.split('/').at(-1) ?? displayPath;
}

export function joinDocumentPath(parentPath: string, name: string): string | null {
    return normalizeDocumentPath(parentPath ? `${parentPath}/${name}` : name);
}

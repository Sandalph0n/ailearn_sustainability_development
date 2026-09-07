const MAX_PATH_LENGTH = 512;
const MAX_NAME_LENGTH = 255;

export function normalizeDocumentName(input: string): string | null {
    const name = input.trim();
    if (
        !name ||
        name.length > MAX_NAME_LENGTH ||
        name === '.' ||
        name === '..' ||
        name.includes('/') ||
        name.includes('\\')
    ) {
        return null;
    }
    return name;
}

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

export function documentParentPath(path: string): string {
    const separator = path.lastIndexOf('/');
    return separator === -1 ? '' : path.slice(0, separator);
}

export function documentBaseName(path: string): string {
    return path.split('/').at(-1) ?? path;
}

export function joinDocumentPath(parentPath: string, name: string): string | null {
    return normalizeDocumentPath(parentPath ? `${parentPath}/${name}` : name);
}

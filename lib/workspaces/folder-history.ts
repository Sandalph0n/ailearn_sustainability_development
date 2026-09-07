export type FolderHistoryState = {
    entries: string[];
    index: number;
};

export const EMPTY_FOLDER_HISTORY: FolderHistoryState = {
    entries: [],
    index: -1,
};

const MAX_HISTORY_ENTRIES = 100;

export function parseFolderHistory(value: string | null): FolderHistoryState {
    if (!value) return EMPTY_FOLDER_HISTORY;

    try {
        const candidate = JSON.parse(value) as Partial<FolderHistoryState>;
        if (!Array.isArray(candidate.entries)) return EMPTY_FOLDER_HISTORY;

        const entries = candidate.entries.filter(
            (entry): entry is string => typeof entry === 'string',
        );
        if (entries.length === 0) return EMPTY_FOLDER_HISTORY;

        const requestedIndex = Number.isInteger(candidate.index)
            ? (candidate.index as number)
            : entries.length - 1;

        return {
            entries,
            index: Math.max(0, Math.min(requestedIndex, entries.length - 1)),
        };
    } catch {
        return EMPTY_FOLDER_HISTORY;
    }
}

export function recordFolderVisit(
    history: FolderHistoryState,
    path: string,
): FolderHistoryState {
    if (history.entries[history.index] === path) return history;

    const entries = [...history.entries.slice(0, history.index + 1), path].slice(
        -MAX_HISTORY_ENTRIES,
    );
    return { entries, index: entries.length - 1 };
}

export function findFolderHistoryTarget(
    history: FolderHistoryState,
    direction: -1 | 1,
    validPaths: ReadonlySet<string>,
): { history: FolderHistoryState; path: string } | null {
    let index = history.index + direction;

    while (index >= 0 && index < history.entries.length) {
        const path = history.entries[index];
        if (validPaths.has(path)) {
            return {
                history: { ...history, index },
                path,
            };
        }
        index += direction;
    }

    return null;
}

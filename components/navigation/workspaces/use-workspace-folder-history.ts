'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
    findFolderHistoryTarget,
    parseFolderHistory,
    recordFolderVisit,
    type FolderHistoryState,
} from '@/lib/workspaces/folder-history';

const HISTORY_EVENT = 'lernumi:workspace-folder-history';

function serverSnapshot() {
    return '';
}

function storageKey(workspaceId: string) {
    return `lernumi:workspace-folder-history:${workspaceId}`;
}

function readHistory(key: string): FolderHistoryState {
    try {
        return parseFolderHistory(window.sessionStorage.getItem(key));
    } catch {
        return parseFolderHistory(null);
    }
}

function writeHistory(key: string, history: FolderHistoryState) {
    try {
        const value = JSON.stringify(history);
        if (window.sessionStorage.getItem(key) === value) return;
        window.sessionStorage.setItem(key, value);
        window.dispatchEvent(new CustomEvent(HISTORY_EVENT, { detail: key }));
    } catch {
        // Navigation still works; only persistence is unavailable.
    }
}

export function useWorkspaceFolderHistory({
    workspaceId,
    currentFolderId,
    validFolderIds,
}: {
    workspaceId: string;
    currentFolderId: string;
    validFolderIds: ReadonlySet<string>;
}) {
    const key = storageKey(workspaceId);
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            function onHistoryChange(event: Event) {
                if (event instanceof CustomEvent && event.detail === key) onStoreChange();
            }

            function onStorage(event: StorageEvent) {
                if (event.storageArea === window.sessionStorage && event.key === key) {
                    onStoreChange();
                }
            }

            window.addEventListener(HISTORY_EVENT, onHistoryChange);
            window.addEventListener('storage', onStorage);
            return () => {
                window.removeEventListener(HISTORY_EVENT, onHistoryChange);
                window.removeEventListener('storage', onStorage);
            };
        },
        [key],
    );
    const getSnapshot = useCallback(() => {
        try {
            return window.sessionStorage.getItem(key) ?? '';
        } catch {
            return '';
        }
    }, [key]);
    const serialized = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
    const history = parseFolderHistory(serialized);
    const backTarget = findFolderHistoryTarget(history, -1, validFolderIds);
    const forwardTarget = findFolderHistoryTarget(history, 1, validFolderIds);

    useEffect(() => {
        writeHistory(key, recordFolderVisit(readHistory(key), currentFolderId));
    }, [currentFolderId, key]);

    function move(direction: -1 | 1): string | null {
        const target = findFolderHistoryTarget(readHistory(key), direction, validFolderIds);
        if (!target) return null;
        writeHistory(key, target.history);
        return target.path;
    }

    return {
        canGoBack: backTarget !== null,
        canGoForward: forwardTarget !== null,
        goBack: () => move(-1),
        goForward: () => move(1),
    };
}

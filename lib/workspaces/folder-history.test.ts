import { describe, expect, it } from 'vitest';

import {
    EMPTY_FOLDER_HISTORY,
    findFolderHistoryTarget,
    parseFolderHistory,
    recordFolderVisit,
} from './folder-history';

describe('workspace folder history', () => {
    it('records direct visits and ignores a reload of the same folder', () => {
        const root = recordFolderVisit(EMPTY_FOLDER_HISTORY, '');
        const folder = recordFolderVisit(root, 'src');

        expect(folder).toEqual({ entries: ['', 'src'], index: 1 });
        expect(recordFolderVisit(folder, 'src')).toBe(folder);
    });

    it('drops the forward branch after a new visit', () => {
        const history = { entries: ['', 'src', 'src/lib'], index: 1 };

        expect(recordFolderVisit(history, 'docs')).toEqual({
            entries: ['', 'src', 'docs'],
            index: 2,
        });
    });

    it('moves in both directions and skips folders that no longer exist', () => {
        const history = { entries: ['', 'deleted', 'src'], index: 2 };
        const validPaths = new Set(['', 'src']);
        const back = findFolderHistoryTarget(history, -1, validPaths);

        expect(back).toEqual({
            history: { entries: ['', 'deleted', 'src'], index: 0 },
            path: '',
        });
        expect(findFolderHistoryTarget(back!.history, 1, validPaths)).toEqual({
            history: { entries: ['', 'deleted', 'src'], index: 2 },
            path: 'src',
        });
    });

    it('recovers safely from malformed persisted data', () => {
        expect(parseFolderHistory('{broken')).toEqual(EMPTY_FOLDER_HISTORY);
        expect(parseFolderHistory('{"entries":["",7,"src"],"index":99}')).toEqual({
            entries: ['', 'src'],
            index: 1,
        });
    });
});

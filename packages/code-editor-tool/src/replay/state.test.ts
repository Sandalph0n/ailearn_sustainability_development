import { describe, expect, it } from 'vitest';

import type { ToolEvent } from '../platform/types';
import { replayStateAt } from './state';

const at = '2026-09-13T00:00:00.000Z';
const events: ToolEvent[] = [
    { schema: 1, type: 'file.snapshot', at, documentId: 'a', path: '/src/index.ts', encoding: 'utf-8', chunkIndex: 0, chunkCount: 1, content: 'const n = 1;' },
    { schema: 1, type: 'text.changed', at, documentId: 'a', path: '/src/index.ts', changes: [{ rangeOffset: 10, rangeLength: 1, text: '2' }] },
    { schema: 1, type: 'folder.renamed', at, documentId: 'folder', fromPath: '/src', toPath: '/source' },
    { schema: 1, type: 'editor.active', at, path: '/source/index.ts' },
];

describe('replayStateAt', () => {
    it('reconstructs edits and recursive folder renames', () => {
        const state = replayStateAt(events, events.length - 1);
        expect(state.files.get('a')).toMatchObject({ path: '/source/index.ts', content: 'const n = 2;' });
        expect(state.activePath).toBe('/source/index.ts');
    });

    it('can inspect an earlier point without mutating later state', () => {
        expect(replayStateAt(events, 0).files.get('a')?.content).toBe('const n = 1;');
        expect(replayStateAt(events, 1).files.get('a')?.content).toBe('const n = 2;');
    });
});

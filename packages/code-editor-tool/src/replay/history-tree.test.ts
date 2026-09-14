import { describe, expect, it } from 'vitest';
import type { ReplayState } from '@lernumi/replay-core';

import { historyChildren } from './history-tree';

function workspace(): ReplayState {
    return {
        files: new Map([
            ['a', { documentId: 'a', path: '/src/index.ts', content: 'one\ntwo', complete: true }],
            ['b', { documentId: 'b', path: '/README.md', content: '# Project', complete: true }],
        ]),
        folders: new Map([
            ['src', { documentId: 'src', path: '/src' }],
            ['empty', { documentId: 'empty', path: '/empty' }],
            ['nested', { documentId: 'nested', path: '/src/nested' }],
        ]),
        activePath: '/src/index.ts',
        selections: [],
        visibleRange: null,
    };
}

describe('historyChildren', () => {
    it('lists folders before files and preserves empty folders', () => {
        expect(historyChildren(workspace())).toEqual([
            { kind: 'folder', name: 'empty', path: '/empty', lines: null },
            { kind: 'folder', name: 'src', path: '/src', lines: null },
            { kind: 'file', name: 'README.md', path: '/README.md', lines: 1 },
        ]);
    });

    it('returns only direct children with line counts', () => {
        expect(historyChildren(workspace(), '/src')).toEqual([
            { kind: 'folder', name: 'nested', path: '/src/nested', lines: null },
            { kind: 'file', name: 'index.ts', path: '/src/index.ts', lines: 2 },
        ]);
    });
});

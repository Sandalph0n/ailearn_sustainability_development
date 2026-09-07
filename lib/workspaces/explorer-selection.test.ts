import { describe, expect, it } from 'vitest';

import { updateExplorerSelection } from './explorer-selection';

const IDS = ['a', 'b', 'c', 'd', 'e'];
const plain = { shiftKey: false, ctrlKey: false, metaKey: false };

describe('workspace explorer selection', () => {
    it('replaces the selection on a plain click', () => {
        expect(updateExplorerSelection(
            { selectedIds: ['a', 'b'], anchorId: 'a' },
            IDS,
            'd',
            plain,
        )).toEqual({ selectedIds: ['d'], anchorId: 'd' });
    });

    it('toggles an item with Control or Command', () => {
        const selected = updateExplorerSelection(
            { selectedIds: ['b'], anchorId: 'b' },
            IDS,
            'd',
            { ...plain, ctrlKey: true },
        );
        expect(selected).toEqual({ selectedIds: ['b', 'd'], anchorId: 'd' });
        expect(updateExplorerSelection(
            selected,
            IDS,
            'b',
            { ...plain, metaKey: true },
        )).toEqual({ selectedIds: ['d'], anchorId: 'b' });
    });

    it('selects an inclusive range from the stable anchor with Shift', () => {
        expect(updateExplorerSelection(
            { selectedIds: ['b'], anchorId: 'b' },
            IDS,
            'e',
            { ...plain, shiftKey: true },
        )).toEqual({ selectedIds: ['b', 'c', 'd', 'e'], anchorId: 'b' });
    });

    it('adds a range when Shift is combined with Control or Command', () => {
        expect(updateExplorerSelection(
            { selectedIds: ['a', 'd'], anchorId: 'd' },
            IDS,
            'b',
            { shiftKey: true, ctrlKey: true, metaKey: false },
        )).toEqual({ selectedIds: ['a', 'b', 'c', 'd'], anchorId: 'd' });
    });

    it('uses the target as the range anchor when no valid anchor exists', () => {
        expect(updateExplorerSelection(
            { selectedIds: [], anchorId: 'missing' },
            IDS,
            'c',
            { ...plain, shiftKey: true },
        )).toEqual({ selectedIds: ['c'], anchorId: 'c' });
    });
});

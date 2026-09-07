export type ExplorerSelectionModifiers = {
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
};

export type ExplorerSelection = {
    selectedIds: string[];
    anchorId: string | null;
};

/**
 * File-explorer selection rules shared by mouse and keyboard interaction.
 * The ordered IDs must match the order currently rendered on screen so a
 * Shift selection always covers the visible range the user expects.
 */
export function updateExplorerSelection(
    current: ExplorerSelection,
    orderedIds: readonly string[],
    targetId: string,
    modifiers: ExplorerSelectionModifiers,
): ExplorerSelection {
    if (!orderedIds.includes(targetId)) return current;

    const toggle = modifiers.ctrlKey || modifiers.metaKey;
    if (modifiers.shiftKey) {
        const anchorId = current.anchorId && orderedIds.includes(current.anchorId)
            ? current.anchorId
            : targetId;
        const anchorIndex = orderedIds.indexOf(anchorId);
        const targetIndex = orderedIds.indexOf(targetId);
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const range = orderedIds.slice(start, end + 1);

        return {
            selectedIds: toggle
                ? orderedIds.filter((id) => current.selectedIds.includes(id) || range.includes(id))
                : range,
            anchorId,
        };
    }

    if (toggle) {
        const selected = new Set(current.selectedIds);
        if (selected.has(targetId)) selected.delete(targetId);
        else selected.add(targetId);
        return {
            selectedIds: orderedIds.filter((id) => selected.has(id)),
            anchorId: targetId,
        };
    }

    return { selectedIds: [targetId], anchorId: targetId };
}

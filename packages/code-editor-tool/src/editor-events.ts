import * as vscode from 'vscode';

import type { EventRecorder } from './platform/event-recorder';
import { editorEvent } from './platform/event-recorder';
import type { LernumiFileSystemProvider } from './platform/file-system';
import { WORKSPACE_SCHEME } from './platform/file-system';

export function connectEditorEvents(
    provider: LernumiFileSystemProvider,
    recorder: EventRecorder,
): vscode.Disposable {
    const subscriptions: vscode.Disposable[] = [];
    let selectionTimer: number | undefined;
    let pendingSelection: vscode.TextEditor | null = null;
    let visibleRangeTimer: number | undefined;
    let pendingVisibleEditor: vscode.TextEditor | null = null;
    const highlighted = new Set<string>();

    const recordForEditor = async (
        editor: vscode.TextEditor,
        type: string,
        details: Record<string, unknown>,
    ) => {
        if (editor.document.uri.scheme !== WORKSPACE_SCHEME) return;
        const documentId = await provider.documentIdForPath(editor.document.uri.path);
        if (!documentId) return;
        recorder.add(editorEvent(type, {
            documentId,
            path: editor.document.uri.path,
            ...details,
        }));
    };

    subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((change) => {
            if (change.document.uri.scheme !== WORKSPACE_SCHEME || change.contentChanges.length === 0) return;
            void provider.documentIdForPath(change.document.uri.path).then((documentId) => {
                if (!documentId) return;
                recorder.add(editorEvent('text.changed', {
                    documentId,
                    path: change.document.uri.path,
                    version: change.document.version,
                    changes: change.contentChanges.map((item) => ({
                        rangeOffset: item.rangeOffset,
                        rangeLength: item.rangeLength,
                        text: item.text,
                    })),
                }));
            });
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor?.document.uri.scheme !== WORKSPACE_SCHEME) return;
            void recordForEditor(editor, 'editor.active', {});
        }),
        vscode.window.onDidChangeTextEditorSelection(({ textEditor }) => {
            if (textEditor.document.uri.scheme !== WORKSPACE_SCHEME) return;
            const path = textEditor.document.uri.path;
            const hasHighlight = textEditor.selections.some((selection) => !selection.isEmpty);
            if (!hasHighlight && !highlighted.has(path)) return;
            if (hasHighlight) highlighted.add(path);
            else highlighted.delete(path);
            pendingSelection = textEditor;
            window.clearTimeout(selectionTimer);
            selectionTimer = window.setTimeout(() => {
                const current = pendingSelection;
                if (!current) return;
                void recordForEditor(current, 'editor.selection', {
                    selections: current.selections.map((selection) => ({
                        anchor: { line: selection.anchor.line, character: selection.anchor.character },
                        active: { line: selection.active.line, character: selection.active.character },
                    })),
                });
            }, hasHighlight ? 250 : 0);
        }),
        vscode.window.onDidChangeTextEditorVisibleRanges(({ textEditor, visibleRanges }) => {
            if (textEditor.document.uri.scheme !== WORKSPACE_SCHEME || visibleRanges.length === 0) return;
            pendingVisibleEditor = textEditor;
            window.clearTimeout(visibleRangeTimer);
            visibleRangeTimer = window.setTimeout(() => {
                const current = pendingVisibleEditor;
                if (!current || current.visibleRanges.length === 0) return;
                void recordForEditor(current, 'editor.visible-range', {
                    top: current.visibleRanges[0]!.start.line,
                    bottom: current.visibleRanges.at(-1)!.end.line,
                });
            }, 500);
        }),
    );

    const onPaste = (event: ClipboardEvent) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== WORKSPACE_SCHEME) return;
        const text = event.clipboardData?.getData('text/plain') ?? '';
        void recordForEditor(editor, 'editor.paste', {
            length: text.length,
            lineCount: text ? text.split(/\r?\n/).length : 0,
            text,
        });
    };
    document.addEventListener('paste', onPaste, true);

    return new vscode.Disposable(() => {
        window.clearTimeout(selectionTimer);
        window.clearTimeout(visibleRangeTimer);
        document.removeEventListener('paste', onPaste, true);
        for (const subscription of subscriptions) subscription.dispose();
    });
}

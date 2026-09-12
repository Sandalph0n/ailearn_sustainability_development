import * as vscode from 'vscode';

import type { EventRecorder } from './platform/event-recorder';
import { editorEvent } from './platform/event-recorder';
import type { AiLearnFileSystemProvider } from './platform/file-system';
import { WORKSPACE_SCHEME } from './platform/file-system';

export function connectEditorEvents(
    provider: AiLearnFileSystemProvider,
    recorder: EventRecorder,
): vscode.Disposable {
    const subscriptions: vscode.Disposable[] = [];
    let selectionTimer: number | undefined;
    let pendingSelection: vscode.TextEditor | null = null;

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
            recorder.add(editorEvent('editor.active', { path: editor.document.uri.path }));
        }),
        vscode.window.onDidChangeTextEditorSelection(({ textEditor }) => {
            if (textEditor.document.uri.scheme !== WORKSPACE_SCHEME) return;
            pendingSelection = textEditor;
            window.clearTimeout(selectionTimer);
            selectionTimer = window.setTimeout(() => {
                const current = pendingSelection;
                if (!current) return;
                recorder.add(editorEvent('editor.selection', {
                    path: current.document.uri.path,
                    selections: current.selections.map((selection) => ({
                        anchor: { line: selection.anchor.line, character: selection.anchor.character },
                        active: { line: selection.active.line, character: selection.active.character },
                    })),
                }));
            }, 180);
        }),
    );

    return new vscode.Disposable(() => {
        window.clearTimeout(selectionTimer);
        for (const subscription of subscriptions) subscription.dispose();
    });
}

import { Event } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event';
import type {
    IStorageDatabase,
    IUpdateRequest,
} from '@codingame/monaco-vscode-api/vscode/vs/base/parts/storage/common/storage';

/** Persist VS Code preferences on the isolated tool origin, with an in-memory fallback. */
export class BrowserStorageDatabase implements IStorageDatabase {
    readonly onDidChangeItemsExternal = Event.None;
    private readonly items = new Map<string, string>();

    constructor(private readonly key: string) {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) return;
            for (const [itemKey, value] of Object.entries(JSON.parse(stored) as Record<string, string>)) {
                if (typeof value === 'string') this.items.set(itemKey, value);
            }
        } catch {
            // Storage can be unavailable in hardened browser contexts. The workbench remains usable.
        }
    }

    async getItems(): Promise<Map<string, string>> {
        return new Map(this.items);
    }

    async updateItems(request: IUpdateRequest): Promise<void> {
        for (const [key, value] of request.insert ?? []) this.items.set(key, value);
        for (const key of request.delete ?? []) this.items.delete(key);
        try {
            localStorage.setItem(this.key, JSON.stringify(Object.fromEntries(this.items)));
        } catch {
            // Continue in memory when quota or browser policy blocks persistence.
        }
    }

    async optimize(): Promise<void> {}
    async close(): Promise<void> {}
}

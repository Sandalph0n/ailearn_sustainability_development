import { Event } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event';
import type {
    IStorageDatabase,
    IUpdateRequest,
} from '@codingame/monaco-vscode-api/vscode/vs/base/parts/storage/common/storage';

/** Opaque-origin tool iframes cannot rely on localStorage or IndexedDB. */
export class MemoryStorageDatabase implements IStorageDatabase {
    readonly onDidChangeItemsExternal = Event.None;
    private readonly items = new Map<string, string>();

    async getItems(): Promise<Map<string, string>> {
        return new Map(this.items);
    }

    async updateItems(request: IUpdateRequest): Promise<void> {
        for (const [key, value] of request.insert ?? []) this.items.set(key, value);
        for (const key of request.delete ?? []) this.items.delete(key);
    }

    async optimize(): Promise<void> {}
    async close(): Promise<void> {}
}

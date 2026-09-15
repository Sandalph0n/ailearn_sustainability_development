/**
 * Diagrams on top of Lernumi workspace documents.
 *
 * easydraw.net keeps diagrams as rows in its own database. Inside Lernumi the
 * student's work must live in the assessment attempt's workspace, so every
 * diagram becomes one `<title>.easydraw` file at the workspace root — the same
 * XML envelope "Save As" downloads, which means a marker can open the file in
 * easydraw.net as well. Title, status and diagram type travel inside the JSON.
 *
 * The document list only carries names and content hashes, so the dashboard
 * reads each file once and caches the parsed header by hash.
 */
import { parseEasyDraw, serializeEasyDraw } from '@/lib/exporters/easydraw';
import type { DiagramStatus } from '@/lib/stores/editor-meta.store';
import { ToolApiError, type ToolApiClient } from './platform/client';
import { toolEvent } from './platform/event-recorder';
import type { ToolDocument, ToolEvent } from './platform/types';

export const DIAGRAM_EXTENSION = '.easydraw';
const MIME_TYPE = 'application/xml';

export type DiagramSummary = {
  id: string;
  title: string;
  type: string;
  status: DiagramStatus;
  updatedAt: string;
};

/** JSON payload inside the envelope. `pages`/`activePageId` belong to the editor. */
export type DiagramFile = {
  fileName?: string;
  status?: string;
  type?: string;
  pages?: unknown;
  activePageId?: unknown;
  [key: string]: unknown;
};

type CacheEntry = { hash: string | null; raw: string; file: DiagramFile; document: ToolDocument };

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function normalizeStatus(status: unknown): DiagramStatus {
  return status === 'complete' || status === 'archived' ? status : 'draft';
}

function titleFromDocument(document: ToolDocument): string {
  return document.name.endsWith(DIAGRAM_EXTENSION)
    ? document.name.slice(0, -DIAGRAM_EXTENSION.length)
    : document.name;
}

/** File names are shown in Lernumi's own explorer, so keep them readable but safe. */
export function fileNameFor(title: string): string {
  const safe = title
    .replace(/[\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${safe || 'Untitled'}${DIAGRAM_EXTENSION}`;
}

export function parseDiagramText(text: string): DiagramFile {
  if (!text.trim()) return {};
  try {
    const json = parseEasyDraw(text) ?? text;
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as DiagramFile) : {};
  } catch {
    return {};
  }
}

function serializeFile(file: DiagramFile): { raw: string; bytes: Uint8Array } {
  const raw = serializeEasyDraw(JSON.stringify(file, null, 2));
  return { raw, bytes: encoder.encode(raw) };
}

export class LernumiDiagrams {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly client: ToolApiClient,
    private readonly record: (event: ToolEvent) => void = () => undefined,
  ) {}

  private summarize(entry: CacheEntry): DiagramSummary {
    return {
      id: entry.document.id,
      title: entry.file.fileName?.trim() || titleFromDocument(entry.document),
      type: typeof entry.file.type === 'string' ? entry.file.type : 'erd',
      status: normalizeStatus(entry.file.status),
      updatedAt: entry.document.updatedAt,
    };
  }

  private async load(document: ToolDocument): Promise<CacheEntry> {
    const cached = this.cache.get(document.id);
    if (cached && cached.hash === document.contentHash) {
      cached.document = document;
      return cached;
    }
    const { bytes, etag } = await this.client.readDocument(document.id);
    const raw = decoder.decode(bytes);
    const entry: CacheEntry = {
      hash: etag ?? document.contentHash,
      raw,
      file: parseDiagramText(raw),
      document,
    };
    this.cache.set(document.id, entry);
    return entry;
  }

  /** Capture existing diagrams as the hidden time-zero state of a new work session. */
  async captureBaseline(): Promise<void> {
    const documents = await this.client.listDocuments(null);
    const files = documents.filter(
      (document) => document.entryKind === 'FILE' && document.name.endsWith(DIAGRAM_EXTENSION),
    );
    for (const document of files) {
      const entry = await this.load(document);
      this.recordSnapshot(entry);
    }
  }

  async list(): Promise<DiagramSummary[]> {
    const documents = await this.client.listDocuments(null);
    const files = documents.filter(
      (document) => document.entryKind === 'FILE' && document.name.endsWith(DIAGRAM_EXTENSION),
    );
    const entries = await Promise.all(files.map((document) => this.load(document)));
    return entries.map((entry) => this.summarize(entry));
  }

  /** Full content for the editor. Returns null when the file is gone. */
  async open(diagramId: string): Promise<{ summary: DiagramSummary; file: DiagramFile } | null> {
    let document: ToolDocument;
    try {
      const result = await this.client.getDocument(diagramId);
      document = result;
    } catch (error) {
      if (error instanceof ToolApiError && error.status === 404) return null;
      throw error;
    }
    const entry = await this.load(document);
    this.record(toolEvent('editor.active', {
      documentId: document.id,
      path: pathFor(document.name),
      diagramType: this.summarize(entry).type,
    }));
    return { summary: this.summarize(entry), file: entry.file };
  }

  async create(input: { title: string; type: string; file?: DiagramFile }): Promise<DiagramSummary> {
    const file: DiagramFile = {
      ...(input.file ?? {}),
      fileName: input.title,
      type: input.type,
      status: normalizeStatus(input.file?.status),
    };
    const serialized = serializeFile(file);
    const document = await this.createNamed(fileNameFor(input.title));
    const path = pathFor(document.name);
    this.record(toolEvent('file.created', { documentId: document.id, path, entryKind: 'diagram' }));
    const saveRequestId = crypto.randomUUID();
    this.recordFullChange(document.id, path, '', serialized.raw);
    this.record(toolEvent('file.save-requested', { documentId: document.id, path, saveRequestId }));
    const written = await this.client.writeDocument(
      document.id,
      serialized.bytes,
      document.contentHash ?? '',
      MIME_TYPE,
    );
    if (written.contentHash) {
      this.record(toolEvent('file.saved', {
        documentId: document.id,
        path,
        saveRequestId,
        contentHash: written.contentHash,
      }));
    }
    const entry: CacheEntry = { hash: written.contentHash, raw: serialized.raw, file, document: written };
    this.cache.set(written.id, entry);
    return this.summarize(entry);
  }

  /** Sibling names are unique per folder; retry with a numeric suffix on 409. */
  private async createNamed(name: string): Promise<ToolDocument> {
    const stem = name.slice(0, -DIAGRAM_EXTENSION.length);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? name : `${stem} (${attempt + 1})${DIAGRAM_EXTENSION}`;
      try {
        return await this.client.createDocument({ entryKind: 'FILE', name: candidate, parentFolderId: null });
      } catch (error) {
        if (!(error instanceof ToolApiError && error.status === 409)) throw error;
      }
    }
    throw new Error('Could not find a free file name for this diagram');
  }

  /**
   * Autosave target. `data` is the editor state (already carrying fileName and
   * status); `title` doubles as the file name, so a rename in the MenuBar also
   * renames the workspace file when the name is free.
   */
  async save(
    diagramId: string,
    payload: { data: unknown; title: string; status: DiagramStatus },
  ): Promise<void> {
    const previous = this.cache.get(diagramId);
    const type = previous?.file.type ?? 'erd';
    const data = payload.data && typeof payload.data === 'object' ? (payload.data as DiagramFile) : {};
    const file: DiagramFile = { ...data, fileName: payload.title, status: payload.status, type };
    const serialized = serializeFile(file);

    let currentEntry = previous;
    if (!currentEntry) currentEntry = await this.load(await this.client.getDocument(diagramId));
    let etag = currentEntry.hash;
    if (!etag) {
      const current = await this.client.getDocument(diagramId);
      etag = current.contentHash ?? '';
    }

    const oldPath = pathFor(currentEntry.document.name);
    const saveRequestId = crypto.randomUUID();
    if (currentEntry.raw !== serialized.raw) {
      this.recordFullChange(diagramId, oldPath, currentEntry.raw, serialized.raw);
    }
    this.record(toolEvent('file.save-requested', { documentId: diagramId, path: oldPath, saveRequestId }));

    let written: ToolDocument;
    try {
      written = await this.client.writeDocument(diagramId, serialized.bytes, etag, MIME_TYPE);
    } catch (error) {
      // Another tab wrote in between. The workspace belongs to one student, so
      // the newest edit wins; surface it in the console rather than losing it.
      if (!(error instanceof ToolApiError && error.status === 412)) throw error;
      const currentHash = String(error.details?.currentContentHash ?? '');
      console.warn('Diagram changed elsewhere; overwriting with this tab’s version');
      written = await this.client.writeDocument(diagramId, serialized.bytes, currentHash, MIME_TYPE);
    }

    if (written.contentHash) {
      this.record(toolEvent('file.saved', {
        documentId: diagramId,
        path: oldPath,
        saveRequestId,
        contentHash: written.contentHash,
      }));
    }

    const wantedName = fileNameFor(payload.title);
    if (written.name !== wantedName) {
      try {
        const fromPath = pathFor(written.name);
        written = await this.client.updateDocument(diagramId, { name: wantedName });
        this.record(toolEvent('file.renamed', {
          documentId: diagramId,
          fromPath,
          toPath: pathFor(written.name),
        }));
      } catch (error) {
        // Name taken by a sibling: keep the old file name, the title inside is what counts.
        if (!(error instanceof ToolApiError && error.status === 409)) throw error;
      }
    }

    this.cache.set(diagramId, { hash: written.contentHash, raw: serialized.raw, file, document: written });
  }

  async rename(diagramId: string, title: string): Promise<void> {
    const entry = this.cache.get(diagramId) ?? (await this.load(await this.client.getDocument(diagramId)));
    await this.save(diagramId, {
      data: entry.file,
      title,
      status: normalizeStatus(entry.file.status),
    });
  }

  async duplicate(diagramId: string): Promise<DiagramSummary> {
    const entry = this.cache.get(diagramId) ?? (await this.load(await this.client.getDocument(diagramId)));
    const summary = this.summarize(entry);
    return this.create({ title: `${summary.title} (copy)`, type: summary.type, file: entry.file });
  }

  async remove(diagramId: string): Promise<void> {
    const entry = this.cache.get(diagramId) ?? (await this.load(await this.client.getDocument(diagramId)));
    await this.client.deleteDocument(diagramId);
    this.record(toolEvent('file.deleted', {
      documentId: diagramId,
      path: pathFor(entry.document.name),
      entryKind: 'diagram',
    }));
    this.cache.delete(diagramId);
  }

  private recordSnapshot(entry: CacheEntry): void {
    const chunkSize = 64 * 1024;
    const chunks = Math.max(1, Math.ceil(entry.raw.length / chunkSize));
    for (let index = 0; index < chunks; index += 1) {
      this.record(toolEvent('file.snapshot', {
        documentId: entry.document.id,
        path: pathFor(entry.document.name),
        encoding: 'utf-8',
        chunkIndex: index,
        chunkCount: chunks,
        content: entry.raw.slice(index * chunkSize, (index + 1) * chunkSize),
        entryKind: 'diagram',
      }));
    }
  }

  private recordFullChange(documentId: string, path: string, previous: string, next: string): void {
    const chunkSize = 64 * 1024;
    const chunks = Math.max(1, Math.ceil(next.length / chunkSize));
    for (let index = 0; index < chunks; index += 1) {
      const text = next.slice(index * chunkSize, (index + 1) * chunkSize);
      this.record(toolEvent('text.changed', {
        documentId,
        path,
        changes: index === 0
          ? [{ rangeOffset: 0, rangeLength: previous.length, text }]
          : [{ rangeOffset: index * chunkSize, rangeLength: 0, text }],
        chunkIndex: index,
        chunkCount: chunks,
        entryKind: 'diagram',
      }));
    }
  }
}

function pathFor(name: string): string {
  return `/${name}`;
}

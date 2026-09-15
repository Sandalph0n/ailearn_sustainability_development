import {
  buildCombinedReplayTimeline,
  buildReplayTimeline,
  flattenReplayBatches,
  replayCutoff,
  replayStateAt,
  verifyReplayRecording,
  type ReplayBatch,
  type ReplayIntegrity,
  type ReplayTimeline,
  type SequencedReplayEvent,
} from '@lernumi/replay-core';
import type { Edge, Node } from '@xyflow/react';

import { DIAGRAM_EXTENSION, parseDiagramText, type DiagramFile } from '../diagrams';
import type { ToolApiClient } from '../platform/client';
import type { ReplaySession } from '../platform/types';

export const ALL_SESSIONS = 'all';

export type LoadedReplaySession = ReplaySession & {
  events: SequencedReplayEvent[];
  integrity: ReplayIntegrity;
};

export type ReplayData = {
  sessions: LoadedReplaySession[];
};

export type ReplayDiagramPage = {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
};

export type ReplayDiagram = {
  documentId: string;
  path: string;
  title: string;
  type: string;
  activePageId: string | null;
  pages: ReplayDiagramPage[];
};

export type ReplayFrame = {
  position: number;
  total: number;
  at: string | null;
  label: string;
  sessionId: string | null;
  eventType: string | null;
  integrity: ReplayIntegrity['status'];
  diagrams: ReplayDiagram[];
  diagram: ReplayDiagram | null;
};

export type ReplayScopeModel = {
  timeline: ReplayTimeline;
  integrity: ReplayIntegrity['status'];
};

export async function loadReplayData(api: ToolApiClient): Promise<ReplayData> {
  const sessions = (await api.listReplaySessions()).sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.id.localeCompare(b.id),
  );
  const loaded = await Promise.all(sessions.map(async (session): Promise<LoadedReplaySession> => {
    const stored = await api.replayEvents(session.id);
    const batches = stored as ReplayBatch[];
    return {
      ...session,
      events: flattenReplayBatches(batches),
      integrity: await verifyReplayRecording(session.id, batches),
    };
  }));
  return { sessions: loaded };
}

export function replayScope(data: ReplayData, scope: string): ReplayScopeModel {
  const selected = scope === ALL_SESSIONS
    ? data.sessions
    : data.sessions.filter((session) => session.id === scope);
  const timeline = selected.length === 1 && scope !== ALL_SESSIONS
    ? buildReplayTimeline(selected[0]!.events, selected[0]!.id)
    : buildCombinedReplayTimeline(selected.map((session) => ({
        sessionId: session.id,
        events: session.events,
      })));
  return {
    timeline: visualTimeline(timeline),
    integrity: aggregateIntegrity(selected.map((session) => session.integrity.status)),
  };
}

export function replayFrame(
  model: ReplayScopeModel,
  position: number,
  pinnedDocumentId: string | null = null,
): ReplayFrame {
  const bounded = Math.max(0, Math.min(position, model.timeline.events.length));
  const state = replayStateAt(model.timeline.allEvents, replayCutoff(model.timeline, bounded));
  const current = bounded > 0 ? model.timeline.events[bounded - 1] : undefined;
  const currentDocumentId = current && typeof current.event.documentId === 'string'
    ? current.event.documentId
    : null;
  const diagrams = [...state.files.values()]
    .filter((file) => file.complete && file.path.endsWith(DIAGRAM_EXTENSION))
    .map((file) => parseReplayDiagram(file.documentId, file.path, file.content))
    .filter((file): file is ReplayDiagram => file !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
  const activeDocumentId = [...state.files.values()]
    .find((file) => file.path === state.activePath)?.documentId ?? null;
  const wanted = pinnedDocumentId ?? currentDocumentId ?? activeDocumentId;
  const diagram = diagrams.find((item) => item.documentId === wanted) ?? diagrams[0] ?? null;

  return {
    position: bounded,
    total: model.timeline.events.length,
    at: current?.event.at ?? null,
    label: current ? describeReplayEvent(current) : 'Start of recording',
    sessionId: bounded > 0 ? model.timeline.eventSessionIds[bounded - 1] ?? null : null,
    eventType: current?.event.type ?? null,
    integrity: model.integrity,
    diagrams,
    diagram,
  };
}

export function eventDelay(
  model: ReplayScopeModel,
  position: number,
  mode: 'time' | 'event',
  rate: number,
  cadence: number,
): number {
  if (mode === 'event') return cadence;
  const current = model.timeline.events[position - 1];
  const next = model.timeline.events[position];
  if (!current || !next) return 0;
  const elapsed = Math.max(40, Date.parse(next.event.at) - Date.parse(current.event.at));
  // A long night away remains visible as a pause, without making replay wait all night.
  const compressed = elapsed <= 10 * 60_000
    ? elapsed
    : 10 * 60_000 + Math.log2(elapsed / (10 * 60_000)) * 30_000;
  return Math.min(5_000, Math.max(40, compressed / Math.max(rate, 0.1)));
}

function visualTimeline(source: ReplayTimeline): ReplayTimeline {
  const visible = source.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isVisualEvent(event));
  return {
    ...source,
    events: visible.map(({ event }) => event),
    eventIndexes: visible.map(({ index }) => source.eventIndexes[index]!),
    eventSessionIds: visible.map(({ index }) => source.eventSessionIds[index]!),
  };
}

function isVisualEvent(item: SequencedReplayEvent): boolean {
  if (item.event.type === 'file.save-requested' || item.event.type === 'file.saved' || item.event.type === 'session.ended') {
    return false;
  }
  if (item.event.type === 'text.changed') {
    const chunkIndex = typeof item.event.chunkIndex === 'number' ? item.event.chunkIndex : 0;
    const chunkCount = typeof item.event.chunkCount === 'number' ? item.event.chunkCount : 1;
    return chunkIndex === chunkCount - 1;
  }
  return true;
}

function parseReplayDiagram(documentId: string, path: string, content: string): ReplayDiagram | null {
  const file = parseDiagramText(content);
  const pages = diagramPages(file);
  if (pages.length === 0) return null;
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  const fallback = fileName.endsWith(DIAGRAM_EXTENSION)
    ? fileName.slice(0, -DIAGRAM_EXTENSION.length)
    : fileName;
  return {
    documentId,
    path,
    title: typeof file.fileName === 'string' && file.fileName.trim() ? file.fileName : fallback,
    type: typeof file.type === 'string' ? file.type : 'erd',
    activePageId: typeof file.activePageId === 'string' ? file.activePageId : pages[0]?.id ?? null,
    pages,
  };
}

function diagramPages(file: DiagramFile): ReplayDiagramPage[] {
  if (!Array.isArray(file.pages)) return [];
  return file.pages.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const page = candidate as Record<string, unknown>;
    if (typeof page.id !== 'string' || typeof page.name !== 'string') return [];
    if (!Array.isArray(page.nodes) || !Array.isArray(page.edges)) return [];
    return [{
      id: page.id,
      name: page.name,
      nodes: cloneGraph(page.nodes as Node[]),
      edges: cloneGraph(page.edges as Edge[]),
    }];
  });
}

function cloneGraph<T extends { selected?: boolean }>(items: T[]): T[] {
  return JSON.parse(JSON.stringify(items)).map((item: T) => ({ ...item, selected: false })) as T[];
}

export function describeReplayEvent(item: SequencedReplayEvent): string {
  const path = eventPath(item);
  switch (item.event.type) {
    case 'file.created': return `Created ${path}`;
    case 'text.changed': return `Edited ${path}`;
    case 'file.renamed': {
      const from = shortPath(typeof item.event.fromPath === 'string' ? item.event.fromPath : 'diagram');
      const to = shortPath(typeof item.event.toPath === 'string' ? item.event.toPath : 'diagram');
      return `Renamed ${from} to ${to}`;
    }
    case 'file.deleted': return `Deleted ${path}`;
    case 'editor.active': return `Opened ${path}`;
    default: return item.event.type.replaceAll('.', ' ');
  }
}

function eventPath(item: SequencedReplayEvent): string {
  const value = typeof item.event.path === 'string'
    ? item.event.path
    : typeof item.event.toPath === 'string'
      ? item.event.toPath
      : 'diagram';
  return shortPath(value);
}

function shortPath(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.endsWith(DIAGRAM_EXTENSION) ? name.slice(0, -DIAGRAM_EXTENSION.length) : name;
}

function aggregateIntegrity(statuses: ReplayIntegrity['status'][]): ReplayIntegrity['status'] {
  if (statuses.includes('INVALID')) return 'INVALID';
  if (statuses.includes('GAP')) return 'GAP';
  if (statuses.includes('LEGACY')) return 'LEGACY';
  return 'VERIFIED';
}

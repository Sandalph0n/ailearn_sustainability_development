import { describe, expect, it } from 'vitest';
import type { ReplayEvent, SequencedReplayEvent } from '@lernumi/replay-core';

import { replayFrame, replayScope, type ReplayData } from './model';

const at = '2026-09-15T08:00:00.000Z';

function sequence(sequence: number, event: ReplayEvent): SequencedReplayEvent {
  return { sequence, batchId: 'batch', clientAt: at, receivedAt: at, event };
}

function data(events: SequencedReplayEvent[]): ReplayData {
  return {
    sessions: [{
      id: 'session-a',
      startedAt: at,
      endedAt: null,
      toolVersion: { id: 'version', version: '0.2.0' },
      eventBatchCount: 1,
      checkpoint: events.length - 1,
      lastReceivedAt: at,
      currentRuntimeCompatible: true,
      events,
      integrity: {
        status: 'VERIFIED', checkedBatches: 1, checkedEvents: events.length,
        checkedCheckpoints: 0, head: null, issueBatchId: null, message: 'ok',
      },
    }],
  };
}

const initial = JSON.stringify({
  fileName: 'Model', type: 'erd', activePageId: 'p1',
  pages: [{ id: 'p1', name: 'Page 1', nodes: [], edges: [] }],
});

describe('EasyDraw replay model', () => {
  it('treats launch snapshots as time zero', () => {
    const events = [
      sequence(0, { schema: 1, type: 'session.started', at }),
      sequence(1, { schema: 1, type: 'file.snapshot', at, documentId: 'doc', path: '/Model.easydraw', encoding: 'utf-8', chunkIndex: 0, chunkCount: 1, content: initial }),
      sequence(2, { schema: 1, type: 'editor.active', at, documentId: 'doc', path: '/Model.easydraw' }),
    ];
    const scope = replayScope(data(events), 'all');
    const frame = replayFrame(scope, 0);
    expect(frame.total).toBe(1);
    expect(frame.diagram?.title).toBe('Model');
  });

  it('hides transport checkpoints and intermediate content chunks', () => {
    const events = [
      sequence(0, { schema: 1, type: 'session.started', at }),
      sequence(1, { schema: 1, type: 'file.created', at, documentId: 'doc', path: '/Model.easydraw' }),
      sequence(2, { schema: 1, type: 'text.changed', at, documentId: 'doc', path: '/Model.easydraw', chunkIndex: 0, chunkCount: 2, changes: [{ rangeOffset: 0, rangeLength: 0, text: initial.slice(0, 20) }] }),
      sequence(3, { schema: 1, type: 'text.changed', at, documentId: 'doc', path: '/Model.easydraw', chunkIndex: 1, chunkCount: 2, changes: [{ rangeOffset: 20, rangeLength: 0, text: initial.slice(20) }] }),
      sequence(4, { schema: 1, type: 'file.save-requested', at, documentId: 'doc', path: '/Model.easydraw' }),
      sequence(5, { schema: 1, type: 'file.saved', at, documentId: 'doc', path: '/Model.easydraw' }),
    ];
    const scope = replayScope(data(events), 'all');
    expect(scope.timeline.events.map((item) => item.event.type)).toEqual(['file.created', 'text.changed']);
    expect(replayFrame(scope, 2).diagram?.pages).toHaveLength(1);
  });
});

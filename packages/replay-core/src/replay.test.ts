import { describe, expect, it } from 'vitest';

import {
    flattenReplayBatches,
    replayChainHash,
    replayPayloadHash,
    replayStateAt,
    sha256Hex,
    verifyReplayBatches,
    verifyReplayRecording,
    type ReplayBatch,
} from './index';

const at = '2026-09-15T00:00:00.000Z';

async function batch(previousChainHash: string | null): Promise<ReplayBatch> {
    const events = [
        { schema: 1, type: 'file.snapshot', at, documentId: 'a', path: '/main.ts', encoding: 'utf-8', chunkIndex: 0, chunkCount: 1, content: 'let n = 1;' },
        { schema: 1, type: 'text.changed', at, documentId: 'a', path: '/main.ts', changes: [{ rangeOffset: 8, rangeLength: 1, text: '2' }] },
    ];
    const payloadHash = await replayPayloadHash({
        sessionId: 'session', clientBatchId: 'batch', seqStart: 0, seqEnd: 1, clientAt: at, events,
    });
    return {
        id: 'stored', clientBatchId: 'batch', seqStart: 0, seqEnd: 1, clientAt: at,
        receivedAt: at, events, payloadHash, previousChainHash,
        chainHash: await replayChainHash(previousChainHash, payloadHash),
    };
}

describe('replay core', () => {
    it('verifies and flattens a server hash chain', async () => {
        const stored = await batch(null);
        await expect(verifyReplayBatches('session', [stored])).resolves.toMatchObject({ status: 'VERIFIED' });
        await expect(verifyReplayRecording('session', [stored])).resolves.toMatchObject({ status: 'VERIFIED' });
        expect(flattenReplayBatches([stored]).map((item) => item.sequence)).toEqual([0, 1]);
    });

    it('detects payload mutation', async () => {
        const stored = await batch(null);
        stored.events[1] = { schema: 1, type: 'file.deleted', at };
        await expect(verifyReplayBatches('session', [stored])).resolves.toMatchObject({ status: 'INVALID' });
    });

    it('reconstructs workspace content', async () => {
        const stored = await batch(null);
        const state = replayStateAt(flattenReplayBatches([stored]), 1);
        expect(state.files.get('a')?.content).toBe('let n = 2;');
    });

    it('verifies an async save against the content captured when that save started', async () => {
        const original = 'let n = 1;';
        const contentHash = await sha256Hex(original);
        const events = [
            { schema: 1, type: 'file.snapshot', at, documentId: 'a', path: '/main.ts', encoding: 'utf-8', chunkIndex: 0, chunkCount: 1, content: original },
            { schema: 1, type: 'file.save-requested', at, documentId: 'a', path: '/main.ts', saveRequestId: 'save-1' },
            { schema: 1, type: 'text.changed', at, documentId: 'a', path: '/main.ts', changes: [{ rangeOffset: 8, rangeLength: 1, text: '2' }] },
            { schema: 1, type: 'file.saved', at, documentId: 'a', path: '/main.ts', saveRequestId: 'save-1', contentHash },
        ];
        const payloadHash = await replayPayloadHash({
            sessionId: 'session', clientBatchId: 'async-save', seqStart: 0, seqEnd: 3, clientAt: at, events,
        });
        const stored: ReplayBatch = {
            id: 'async-save', clientBatchId: 'async-save', seqStart: 0, seqEnd: 3, clientAt: at,
            receivedAt: at, events, payloadHash, previousChainHash: null,
            chainHash: await replayChainHash(null, payloadHash),
        };

        await expect(verifyReplayRecording('session', [stored])).resolves.toMatchObject({
            status: 'VERIFIED',
            checkedCheckpoints: 1,
        });
    });
});

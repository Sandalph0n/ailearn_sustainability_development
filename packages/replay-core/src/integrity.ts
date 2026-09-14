import { replayChainHash, replayPayloadHash, sha256Hex } from './canonical';
import { ReplayWorkspace } from './state';
import type {
    ReplayBatch,
    ReplayEvent,
    ReplayIntegrity,
    SequencedReplayEvent,
} from './types';

export async function verifyReplayBatches(
    sessionId: string,
    batches: readonly ReplayBatch[],
): Promise<ReplayIntegrity> {
    let nextSequence = 0;
    let previousChainHash: string | null = null;
    let checkedEvents = 0;
    let legacy = false;

    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index]!;
        if (batch.seqStart !== nextSequence || batch.seqEnd < batch.seqStart) {
            return verdict('GAP', index, checkedEvents, previousChainHash, batch.id,
                `Expected event ${nextSequence}, but batch starts at ${batch.seqStart}.`);
        }
        if (batch.events.length !== batch.seqEnd - batch.seqStart + 1) {
            return verdict('INVALID', index, checkedEvents, previousChainHash, batch.id,
                'The batch sequence range does not match its event count.');
        }

        if (!batch.payloadHash || !batch.chainHash) {
            legacy = true;
        } else {
            const payloadHash = await replayPayloadHash({
                sessionId,
                clientBatchId: batch.clientBatchId,
                seqStart: batch.seqStart,
                seqEnd: batch.seqEnd,
                clientAt: batch.clientAt,
                events: batch.events,
            });
            if (payloadHash !== batch.payloadHash) {
                return verdict('INVALID', index, checkedEvents, previousChainHash, batch.id,
                    'The stored payload no longer matches its server hash.');
            }
            if (batch.previousChainHash !== previousChainHash) {
                return verdict('INVALID', index, checkedEvents, previousChainHash, batch.id,
                    'This batch does not link to the preceding batch.');
            }
            const chainHash = await replayChainHash(previousChainHash, payloadHash);
            if (chainHash !== batch.chainHash) {
                return verdict('INVALID', index, checkedEvents, previousChainHash, batch.id,
                    'The stored chain hash is invalid.');
            }
            previousChainHash = chainHash;
        }

        checkedEvents += batch.events.length;
        nextSequence = batch.seqEnd + 1;
    }

    return {
        status: legacy ? 'LEGACY' : 'VERIFIED',
        checkedBatches: batches.length,
        checkedEvents,
        checkedCheckpoints: 0,
        head: previousChainHash,
        issueBatchId: null,
        message: legacy
            ? 'Sequence is complete, but one or more batches predate integrity hashes.'
            : 'Sequence, payload hashes and the server hash chain are valid.',
    };
}

export async function verifyReplayRecording(
    sessionId: string,
    batches: readonly ReplayBatch[],
): Promise<ReplayIntegrity> {
    const chain = await verifyReplayBatches(sessionId, batches);
    if (chain.status === 'GAP' || chain.status === 'INVALID') return chain;

    const workspace = new ReplayWorkspace();
    const pendingSaves = new Map<string, string>();
    let checkedCheckpoints = 0;
    for (const item of flattenReplayBatches(batches)) {
        const state = workspace.apply(item.event);
        if (item.event.type === 'file.save-requested') {
            const saveRequestId = typeof item.event.saveRequestId === 'string' ? item.event.saveRequestId : null;
            const documentId = typeof item.event.documentId === 'string' ? item.event.documentId : null;
            const file = documentId ? state.files.get(documentId) : undefined;
            if (saveRequestId && file?.complete) pendingSaves.set(saveRequestId, file.content);
            continue;
        }
        if (item.event.type !== 'file.saved') continue;
        const saveRequestId = typeof item.event.saveRequestId === 'string' ? item.event.saveRequestId : null;
        const documentId = typeof item.event.documentId === 'string' ? item.event.documentId : null;
        const expected = typeof item.event.contentHash === 'string' ? item.event.contentHash : null;
        const savedContent = saveRequestId ? pendingSaves.get(saveRequestId) : undefined;
        if (saveRequestId) pendingSaves.delete(saveRequestId);
        // Older recordings have no request id. Skipping their document checkpoint prevents an
        // asynchronous save response from being compared with a newer in-memory edit.
        if (!documentId || !expected || savedContent === undefined) continue;
        checkedCheckpoints += 1;
        const actual = await sha256Hex(savedContent);
        if (actual !== expected) {
            return {
                ...chain,
                status: 'INVALID',
                checkedCheckpoints,
                issueBatchId: item.batchId,
                message: `Saved content at event ${item.sequence} does not match its document checkpoint.`,
            };
        }
    }

    return {
        ...chain,
        checkedCheckpoints,
        message: chain.status === 'LEGACY'
            ? `${chain.message} ${checkedCheckpoints} document checkpoints are valid.`
            : `Sequence, server hash chain and ${checkedCheckpoints} document checkpoints are valid.`,
    };
}

export function flattenReplayBatches(batches: readonly ReplayBatch[]): SequencedReplayEvent[] {
    const result: SequencedReplayEvent[] = [];
    for (const batch of batches) {
        batch.events.forEach((candidate, index) => {
            if (!isReplayEvent(candidate)) return;
            result.push({
                sequence: batch.seqStart + index,
                batchId: batch.id,
                clientAt: batch.clientAt,
                receivedAt: batch.receivedAt,
                event: candidate,
            });
        });
    }
    return result;
}

export function isReplayEvent(value: unknown): value is ReplayEvent {
    if (!value || typeof value !== 'object') return false;
    const item = value as Record<string, unknown>;
    return typeof item.schema === 'number' && typeof item.type === 'string' && typeof item.at === 'string';
}

function verdict(
    status: 'GAP' | 'INVALID',
    checkedBatches: number,
    checkedEvents: number,
    head: string | null,
    issueBatchId: string,
    message: string,
): ReplayIntegrity {
    return { status, checkedBatches, checkedEvents, checkedCheckpoints: 0, head, issueBatchId, message };
}

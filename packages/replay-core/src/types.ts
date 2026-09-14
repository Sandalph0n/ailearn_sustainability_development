export type ReplayEvent = {
    schema: number;
    type: string;
    at: string;
    [key: string]: unknown;
};

export type ReplayBatch = {
    id: string;
    clientBatchId: string;
    seqStart: number;
    seqEnd: number;
    clientAt: string;
    receivedAt: string;
    events: unknown[];
    payloadHash: string | null;
    previousChainHash: string | null;
    chainHash: string | null;
};

export type SequencedReplayEvent = {
    sequence: number;
    batchId: string;
    clientAt: string;
    receivedAt: string;
    event: ReplayEvent;
};

export type IntegrityStatus = 'VERIFIED' | 'LEGACY' | 'GAP' | 'INVALID';

export type ReplayIntegrity = {
    status: IntegrityStatus;
    checkedBatches: number;
    checkedEvents: number;
    checkedCheckpoints: number;
    head: string | null;
    issueBatchId: string | null;
    message: string;
};

export type ReplayFile = {
    documentId: string;
    path: string;
    content: string;
    complete: boolean;
};

export type ReplayFolder = {
    documentId: string;
    path: string;
};

export type ReplaySelection = {
    anchor: { line: number; character: number };
    active: { line: number; character: number };
};

export type ReplayState = {
    files: Map<string, ReplayFile>;
    folders: Map<string, ReplayFolder>;
    activePath: string | null;
    selections: ReplaySelection[];
    visibleRange: { top: number; bottom: number } | null;
};

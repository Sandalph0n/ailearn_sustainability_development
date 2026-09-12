import type { ToolEventApi } from './client';
import { ToolApiError } from './client';
import type { RuntimeContext, ToolEvent } from './types';

const MAX_BATCH_EVENTS = 200;
const SAFE_BATCH_BYTES = 900 * 1024;

type RecorderStatus = 'idle' | 'recording' | 'syncing' | 'offline' | 'error';

export class EventRecorder {
    private queue: ToolEvent[] = [];
    private nextSeq = 0;
    private timer: number | undefined;
    private flushPromise: Promise<void> | null = null;
    private pendingBatch: PendingBatch | null = null;
    private stopped = false;

    constructor(
        private readonly api: ToolEventApi,
        private readonly enabled: boolean,
        private readonly onStatus: (status: RecorderStatus, pending: number) => void = () => undefined,
    ) {}

    async initialize(context: RuntimeContext): Promise<void> {
        if (!this.enabled) return;
        const checkpoint = await this.api.eventCheckpoint();
        if (checkpoint.closed) throw new Error('This work session is already closed');
        this.nextSeq = checkpoint.nextSeq;
        this.add({
            schema: 1,
            type: 'session.started',
            at: new Date().toISOString(),
            workspace: { id: context.workspace.id, name: context.workspace.name },
            assessment: { id: context.assessment.id, name: context.assessment.name },
            offering: {
                id: context.offering.id,
                subjectCode: context.offering.subject.code,
                term: context.offering.term,
            },
            editorEventSchema: 1,
        });
    }

    add(event: ToolEvent): void {
        if (!this.enabled || this.stopped) return;
        this.queue.push(event);
        this.onStatus('recording', this.queue.length);
        if (this.queue.length >= MAX_BATCH_EVENTS) void this.flush();
        else this.schedule();
    }

    async flush(): Promise<void> {
        if (!this.enabled || this.stopped || this.queue.length === 0) return;
        if (this.flushPromise) return this.flushPromise;
        this.flushPromise = this.flushQueued();
        try {
            await this.flushPromise;
        } finally {
            this.flushPromise = null;
        }
    }

    async stop(): Promise<void> {
        window.clearTimeout(this.timer);
        await this.flush();
        this.stopped = true;
    }

    private schedule(): void {
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => void this.flush(), 1_000);
    }

    private async flushQueued(): Promise<void> {
        window.clearTimeout(this.timer);
        while (this.queue.length > 0 && !this.stopped) {
            const batch = this.pendingBatch ?? this.createBatch();
            this.pendingBatch = batch;
            this.onStatus('syncing', this.queue.length);
            try {
                const result = await this.api.appendEvents(batch);
                this.nextSeq = result.checkpoint + 1;
                this.queue.splice(0, batch.events.length);
                this.pendingBatch = null;
            } catch (error) {
                if (
                    error instanceof ToolApiError &&
                    error.code === 'EVENT_SEQUENCE_CONFLICT' &&
                    typeof error.details?.expectedSeqStart === 'number'
                ) {
                    const expected = error.details.expectedSeqStart;
                    if (expected === batch.seqEnd + 1) {
                        // The server committed this exact idempotent batch but its response was lost.
                        this.nextSeq = expected;
                        this.queue.splice(0, batch.events.length);
                    } else {
                        this.nextSeq = expected;
                    }
                    this.pendingBatch = null;
                    continue;
                }
                this.onStatus(error instanceof TypeError ? 'offline' : 'error', this.queue.length);
                this.schedule();
                return;
            }
        }
        this.onStatus('idle', 0);
    }

    private createBatch(): PendingBatch {
        const events = takeEventBatch(this.queue);
        return {
            batchId: crypto.randomUUID(),
            seqStart: this.nextSeq,
            seqEnd: this.nextSeq + events.length - 1,
            clientAt: new Date().toISOString(),
            events,
        };
    }
}

type PendingBatch = {
    batchId: string;
    seqStart: number;
    seqEnd: number;
    clientAt: string;
    events: ToolEvent[];
};

export function takeEventBatch(queue: ToolEvent[]): ToolEvent[] {
    const batch: ToolEvent[] = [];
    for (const candidate of queue.slice(0, MAX_BATCH_EVENTS)) {
        const next = [...batch, candidate];
        if (new TextEncoder().encode(JSON.stringify(next)).byteLength > SAFE_BATCH_BYTES) break;
        batch.push(candidate);
    }
    if (batch.length === 0 && queue[0]) batch.push(queue[0]);
    return batch;
}

export function editorEvent(type: string, details: Record<string, unknown> = {}): ToolEvent {
    return { schema: 1, type, at: new Date().toISOString(), ...details };
}

export type AttemptFlag = {
    key: string;
    kind: 'external-paste' | 'large-insert' | 'idle-then-bulk' | 'clock-skew';
    severity: 'NOTICE' | 'REVIEW';
    at: Date;
    label: string;
    detail: string;
    workSessionId: string;
    sequence: number | null;
};

type EventBatchForFlags = {
    seqStart: number;
    clientAt: Date;
    receivedAt: Date;
    events: unknown;
};

export type WorkSessionForFlags = {
    id: string;
    eventBatches: EventBatchForFlags[];
};

type ParsedEvent = {
    type: string;
    at: Date;
    length: number;
    lineCount: number;
    inserted: number;
    path: string | null;
};

const TEN_MINUTES_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function finiteNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function eventDate(value: unknown, fallback: Date): Date {
    if (typeof value !== 'string') return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function insertedCharacters(event: Record<string, unknown>): number {
    if (!Array.isArray(event.changes)) return 0;
    return event.changes.reduce((total, value) => {
        const change = record(value);
        return total + (typeof change?.text === 'string' ? change.text.length : 0);
    }, 0);
}

function parseEvent(value: unknown, fallback: Date): ParsedEvent | null {
    const event = record(value);
    if (!event || typeof event.type !== 'string') return null;

    return {
        type: event.type,
        at: eventDate(event.at, fallback),
        length: finiteNumber(event.length),
        lineCount: finiteNumber(event.lineCount),
        inserted: insertedCharacters(event),
        path: typeof event.path === 'string' ? event.path : null,
    };
}

function location(path: string | null): string {
    return path ? ` in ${path.replace(/^\//, '')}` : '';
}

/**
 * Small, cross-tool summary for the marking page. Flags are review prompts, never misconduct
 * conclusions. The tool's full inspector remains the source for detailed event interpretation.
 */
export function deriveAttemptFlags(sessions: readonly WorkSessionForFlags[]): AttemptFlag[] {
    const flags: AttemptFlag[] = [];

    for (const session of sessions) {
        const timeline: Array<{ event: ParsedEvent; sequence: number }> = [];

        for (const batch of session.eventBatches) {
            const skew = Math.abs(batch.receivedAt.getTime() - batch.clientAt.getTime());
            if (skew > CLOCK_SKEW_MS) {
                flags.push({
                    key: `${session.id}:clock:${batch.seqStart}`,
                    kind: 'clock-skew',
                    severity: 'NOTICE',
                    at: batch.receivedAt,
                    label: 'Device clock differs from server',
                    detail: `Difference of ${Math.round(skew / 60_000)} minutes.`,
                    workSessionId: session.id,
                    sequence: batch.seqStart,
                });
            }

            const events = Array.isArray(batch.events) ? batch.events : [];
            events.forEach((value, index) => {
                const event = parseEvent(value, batch.clientAt);
                if (event) timeline.push({ event, sequence: batch.seqStart + index });
            });
        }

        timeline.sort(
            (left, right) =>
                left.event.at.getTime() - right.event.at.getTime() ||
                left.sequence - right.sequence,
        );

        let previousAt: Date | null = null;
        for (const { event, sequence } of timeline) {
            const bulkSize = Math.max(event.length, event.inserted);

            if (event.type === 'editor.paste') {
                flags.push({
                    key: `${session.id}:paste:${sequence}`,
                    kind: 'external-paste',
                    severity: event.length > 200 ? 'REVIEW' : 'NOTICE',
                    at: event.at,
                    label: 'Paste from outside the editor',
                    detail: `${event.length} characters${event.lineCount > 0 ? ` across ${event.lineCount} lines` : ''}${location(event.path)}.`,
                    workSessionId: session.id,
                    sequence,
                });
            } else if (event.type === 'text.changed' && event.inserted > 300) {
                flags.push({
                    key: `${session.id}:insert:${sequence}`,
                    kind: 'large-insert',
                    severity: 'REVIEW',
                    at: event.at,
                    label: 'Large text insertion',
                    detail: `${event.inserted} characters inserted at once${location(event.path)}.`,
                    workSessionId: session.id,
                    sequence,
                });
            }

            if (
                previousAt &&
                event.at.getTime() - previousAt.getTime() > TEN_MINUTES_MS &&
                bulkSize > 200
            ) {
                flags.push({
                    key: `${session.id}:idle:${sequence}`,
                    kind: 'idle-then-bulk',
                    severity: 'REVIEW',
                    at: event.at,
                    label: 'Long pause followed by a large change',
                    detail: `${Math.round((event.at.getTime() - previousAt.getTime()) / 60_000)} minutes idle, then ${bulkSize} characters${location(event.path)}.`,
                    workSessionId: session.id,
                    sequence,
                });
            }

            previousAt = event.at;
        }
    }

    return flags.sort((left, right) => left.at.getTime() - right.at.getTime());
}

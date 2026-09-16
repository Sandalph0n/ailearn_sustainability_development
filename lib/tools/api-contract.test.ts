import { describe, expect, it } from 'vitest';

import {
    MAX_EVENTS_PER_BATCH,
    ToolDocumentCreateSchema,
    ToolDocumentUpdateSchema,
    ToolEventBatchSchema,
    ToolSessionRequestSchema,
} from './api-contract';

const ids = {
    attempt: '10000000-0000-4000-8000-000000000001',
    tool: '10000000-0000-4000-8000-000000000002',
    role: '10000000-0000-4000-8000-000000000003',
    workSession: '10000000-0000-4000-8000-000000000004',
};

describe('tool API request contract', () => {
    it('accepts the three explicit session modes and rejects mixed fields', () => {
        expect(
            ToolSessionRequestSchema.safeParse({
                mode: 'PERSONAL',
                workspaceId: ids.attempt,
                toolId: ids.tool,
                roleAssignmentId: ids.role,
            }).success,
        ).toBe(true);
        expect(
            ToolSessionRequestSchema.safeParse({
                mode: 'WORK',
                attemptId: ids.attempt,
                toolId: ids.tool,
                roleAssignmentId: ids.role,
            }).success,
        ).toBe(true);
        expect(
            ToolSessionRequestSchema.safeParse({
                mode: 'REPLAY',
                workSessionId: ids.workSession,
                roleAssignmentId: ids.role,
            }).success,
        ).toBe(true);
        expect(
            ToolSessionRequestSchema.safeParse({
                mode: 'WORK',
                attemptId: ids.attempt,
                toolId: ids.tool,
                workSessionId: ids.workSession,
                roleAssignmentId: ids.role,
            }).success,
        ).toBe(false);
        expect(
            ToolSessionRequestSchema.safeParse({
                mode: 'PERSONAL',
                workspaceId: ids.attempt,
                attemptId: ids.attempt,
                toolId: ids.tool,
                roleAssignmentId: ids.role,
            }).success,
        ).toBe(false);
    });

    it('requires an inclusive, contiguous event range', () => {
        const base = {
            batchId: ids.workSession,
            seqStart: 7,
            seqEnd: 8,
            clientAt: '2026-09-07T12:00:00+10:00',
            events: [{ type: 'insert' }, { type: 'save' }],
        };
        expect(ToolEventBatchSchema.safeParse(base).success).toBe(true);
        expect(
            ToolEventBatchSchema.safeParse({ ...base, events: [{ type: 'insert' }] }).success,
        ).toBe(false);
        expect(
            ToolEventBatchSchema.safeParse({
                ...base,
                seqStart: 0,
                seqEnd: MAX_EVENTS_PER_BATCH,
                events: Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => null),
            }).success,
        ).toBe(false);
    });

    it('keeps document mutations narrow and explicit', () => {
        expect(
            ToolDocumentCreateSchema.safeParse({ entryKind: 'FOLDER', name: 'src' }).success,
        ).toBe(true);
        expect(ToolDocumentUpdateSchema.safeParse({ parentFolderId: null }).success).toBe(true);
        expect(ToolDocumentUpdateSchema.safeParse({}).success).toBe(false);
        expect(
            ToolDocumentCreateSchema.safeParse({
                entryKind: 'FILE',
                name: 'main.ts',
                workspaceId: ids.attempt,
            }).success,
        ).toBe(false);
    });
});

import { z } from 'zod';

export const TOOL_API_VERSION = 'v1' as const;
export const TOOL_API_PREFIX = `/api/tool/${TOOL_API_VERSION}` as const;
export const MAX_EVENT_BATCH_BYTES = 1024 * 1024;
export const MAX_EVENTS_PER_BATCH = 2_000;
export const MAX_REPLAY_BATCHES_PER_PAGE = 200;
export const MAX_DOCUMENTS_PER_PAGE = 200;

export const ToolWorkSessionRequestSchema = z.strictObject({
    mode: z.literal('WORK'),
    attemptId: z.uuid(),
    toolId: z.uuid(),
    roleAssignmentId: z.uuid(),
});

export const ToolPersonalSessionRequestSchema = z.strictObject({
    mode: z.literal('PERSONAL'),
    workspaceId: z.uuid(),
    toolId: z.uuid(),
    roleAssignmentId: z.uuid(),
});

export const ToolReplaySessionRequestSchema = z.strictObject({
    mode: z.literal('REPLAY'),
    workSessionId: z.uuid(),
    roleAssignmentId: z.uuid(),
});

export const ToolSessionRequestSchema = z.discriminatedUnion('mode', [
    ToolWorkSessionRequestSchema,
    ToolPersonalSessionRequestSchema,
    ToolReplaySessionRequestSchema,
]);

export const ToolEventBatchSchema = z
    .strictObject({
        batchId: z.uuid(),
        seqStart: z.number().int().nonnegative().max(2_147_483_647),
        seqEnd: z.number().int().nonnegative().max(2_147_483_647),
        clientAt: z.iso.datetime({ offset: true }),
        events: z.array(z.unknown()).min(1).max(MAX_EVENTS_PER_BATCH),
    })
    .refine((batch) => batch.seqEnd >= batch.seqStart, {
        message: 'seqEnd must be greater than or equal to seqStart',
        path: ['seqEnd'],
    })
    .refine((batch) => batch.events.length === batch.seqEnd - batch.seqStart + 1, {
        message: 'The event count must match the inclusive sequence range',
        path: ['events'],
    });

export const ToolDocumentCreateSchema = z.strictObject({
    entryKind: z.enum(['FILE', 'FOLDER']),
    name: z.string(),
    parentFolderId: z.uuid().nullable().optional(),
});

export const ToolDocumentUpdateSchema = z
    .strictObject({
        name: z.string().optional(),
        parentFolderId: z.uuid().nullable().optional(),
    })
    .refine((value) => value.name !== undefined || value.parentFolderId !== undefined, {
        message: 'Provide a name or parentFolderId',
    });

export const ToolCapabilitySchema = z.enum([
    'files:read',
    'files:write',
    'events:append',
    'replay:read',
]);
export type ToolCapability = z.infer<typeof ToolCapabilitySchema>;
export type ToolSessionRequest = z.infer<typeof ToolSessionRequestSchema>;
export type ToolEventBatch = z.infer<typeof ToolEventBatchSchema>;
export type ToolDocumentCreate = z.infer<typeof ToolDocumentCreateSchema>;
export type ToolDocumentUpdate = z.infer<typeof ToolDocumentUpdateSchema>;

export type ToolDocument = {
    id: string;
    name: string;
    parentFolderId: string | null;
    entryKind: 'FILE' | 'FOLDER';
    contentHash: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
    updatedAt: string;
};

export type ToolSessionResponse = {
    token: string;
    tokenType: 'Bearer';
    expiresIn: number;
    runtimeUrl: string;
    session: {
        id: string;
        mode: 'OWNER' | 'REVIEWER';
        readOnly: boolean;
        capabilities: ToolCapability[];
    };
};

export type ToolApiError = {
    error: {
        code: string;
        message: string;
        fields?: Record<string, string[]>;
        details?: Record<string, unknown>;
    };
};

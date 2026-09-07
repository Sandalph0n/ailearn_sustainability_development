// Route này tạo công cụ mới cùng deployment đầu tiên của nó.
import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';
import {
    guardToolPackageRequest,
    packageFileFrom,
    packageValidationResponse,
} from '@/lib/admin/tool-package-request';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { prismaError } from '@/lib/admin/route-helpers';
import { ToolSchema } from '@/lib/admin/tool-schema';
import { formatValidationErrors } from '@/lib/auth/validation/credentials';
import { db } from '@/lib/db';
import {
    removeToolPackageObjects,
    storeToolPackage,
    type StoredToolPackage,
} from '@/lib/storage/tool-packages';
import { inspectToolPackage, ToolPackageError } from '@/lib/tools/package';

export const runtime = 'nodejs';

/**
 * Không có `GET`: danh sách do `app/admin/tools/page.tsx` đọc thẳng từ database trong Server
 * Component. Thêm một endpoint đọc nữa chỉ để server tự gọi lại chính mình là thừa một vòng mạng
 * và thừa một chỗ phải nhớ kiểm quyền.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardToolPackageRequest(request);
    if (!guard.ok) return guard.response;

    const packageResult = packageFileFrom(guard.formData);
    if (!packageResult.ok) return packageResult.response;

    let metadata: unknown;
    try {
        metadata = JSON.parse(String(guard.formData.get('metadata') ?? ''));
    } catch {
        return errorResponse(400, 'VALIDATION_ERROR', 'Tool metadata is invalid', {
            metadata: ['Metadata must be valid JSON'],
        });
    }

    const parsed = ToolSchema.safeParse(metadata);
    if (!parsed.success) {
        return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Tool metadata is invalid',
            formatValidationErrors(parsed.error),
        );
    }

    let inspected;
    const archive = new Uint8Array(await packageResult.file.arrayBuffer());
    try {
        inspected = await inspectToolPackage(archive, parsed.data.code);
    } catch (error) {
        if (error instanceof ToolPackageError) return packageValidationResponse(error.message);
        throw error;
    }

    const toolId = randomUUID();
    const versionId = randomUUID();
    let stored: StoredToolPackage | undefined;

    try {
        const storedPackage = await storeToolPackage({ toolId, versionId, archive, inspected });
        stored = storedPackage;

        const tool = await db.$transaction(async (tx) => {
            await tx.tool.create({ data: { id: toolId, ...parsed.data } });
            await tx.toolVersion.create({
                data: {
                    id: versionId,
                    toolId,
                    createdById: guard.session.user.id,
                    version: inspected.manifest.version,
                    entryPath: inspected.manifest.entry,
                    manifest: inspected.manifest,
                    archiveKey: storedPackage.archiveKey,
                    storagePrefix: storedPackage.storagePrefix,
                    sha256: inspected.sha256,
                    compressedSize: inspected.compressedSize,
                    unpackedSize: inspected.unpackedSize,
                    fileCount: inspected.fileCount,
                },
            });
            return tx.tool.update({
                where: { id: toolId },
                data: { activeVersionId: versionId },
                select: { id: true, code: true, name: true, activeVersionId: true },
            });
        });
        return jsonResponse({ tool }, { status: 201 });
    } catch (error) {
        if (stored) await removeToolPackageObjects(stored.objectKeys);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return errorResponse(409, 'NAME_ALREADY_EXISTS', 'That tool code or version already exists');
        }
        return prismaError(error, 'Tool', { unique: 'A tool with that code already exists' });
    }
}

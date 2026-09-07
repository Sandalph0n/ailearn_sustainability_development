import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';
import {
    guardToolPackageRequest,
    packageFileFrom,
    packageValidationResponse,
} from '@/lib/admin/tool-package-request';
import { badId, prismaError } from '@/lib/admin/route-helpers';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import {
    removeToolPackageObjects,
    storeToolPackage,
    type StoredToolPackage,
} from '@/lib/storage/tool-packages';
import { inspectToolPackage, ToolPackageError } from '@/lib/tools/package';

export const runtime = 'nodejs';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/tools/[id]/versions'>,
): Promise<NextResponse> {
    const guard = await guardToolPackageRequest(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    const tool = await db.tool.findUnique({ where: { id }, select: { id: true, code: true } });
    if (!tool) return errorResponse(404, 'NOT_FOUND', 'Tool does not exist');

    const packageResult = packageFileFrom(guard.formData);
    if (!packageResult.ok) return packageResult.response;

    const releaseNotesValue = guard.formData.get('releaseNotes');
    const releaseNotes =
        typeof releaseNotesValue === 'string' && releaseNotesValue.trim()
            ? releaseNotesValue.trim()
            : null;
    if (releaseNotes && releaseNotes.length > 2_000) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Release notes are too long', {
            releaseNotes: ['Release notes must be 2,000 characters or fewer'],
        });
    }
    const activate = guard.formData.get('activate') !== 'false';

    const archive = new Uint8Array(await packageResult.file.arrayBuffer());
    let inspected;
    try {
        inspected = await inspectToolPackage(archive, tool.code);
    } catch (error) {
        if (error instanceof ToolPackageError) return packageValidationResponse(error.message);
        throw error;
    }

    const versionId = randomUUID();
    let stored: StoredToolPackage | undefined;
    try {
        const storedPackage = await storeToolPackage({ toolId: id, versionId, archive, inspected });
        stored = storedPackage;
        const version = await db.$transaction(async (tx) => {
            const created = await tx.toolVersion.create({
                data: {
                    id: versionId,
                    toolId: id,
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
                    releaseNotes,
                },
                select: { id: true, version: true },
            });
            if (activate) {
                await tx.tool.update({ where: { id }, data: { activeVersionId: versionId } });
            }
            return created;
        });
        return jsonResponse({ version, active: activate }, { status: 201 });
    } catch (error) {
        if (stored) await removeToolPackageObjects(stored.objectKeys);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return errorResponse(409, 'NAME_ALREADY_EXISTS', 'This version already exists for the tool', {
                package: ['Choose a package with a new manifest version'],
            });
        }
        return prismaError(error, 'Tool version');
    }
}

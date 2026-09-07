import { NextResponse } from 'next/server';

import { badId } from '@/lib/admin/route-helpers';
import { errorResponse } from '@/lib/auth/http/response';
import { requireSystemAdmin } from '@/lib/auth/require-admin';
import { db } from '@/lib/db';
import { getObject } from '@/lib/storage/objects';

export const runtime = 'nodejs';

export async function GET(
    _request: Request,
    { params }: RouteContext<'/api/admin/tools/[id]/versions/[versionId]/download'>,
): Promise<NextResponse> {
    const admin = await requireSystemAdmin();
    if (!admin.ok) return admin.response;

    const { id, versionId } = await params;
    const invalid = badId(id) ?? badId(versionId);
    if (invalid) return invalid;

    const version = await db.toolVersion.findFirst({
        where: { id: versionId, toolId: id },
        select: { archiveKey: true, version: true, tool: { select: { code: true } } },
    });
    if (!version) return errorResponse(404, 'NOT_FOUND', 'Tool version does not exist');

    const object = await getObject({ bucket: 'tools', key: version.archiveKey });
    if (!object) return errorResponse(404, 'NOT_FOUND', 'Tool package is missing from storage');

    return new NextResponse(object.body, {
        headers: {
            'Cache-Control': 'private, no-store',
            'Content-Disposition': `attachment; filename="${version.tool.code}-${version.version}.zip"`,
            'Content-Type': object.contentType,
            ...(object.contentLength === undefined
                ? {}
                : { 'Content-Length': String(object.contentLength) }),
        },
    });
}

import { NextRequest, NextResponse } from 'next/server';

import { badId, guardDelete, prismaError } from '@/lib/admin/route-helpers';
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/tools/[id]/versions/[versionId]/activate'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id, versionId } = await params;
    const invalid = badId(id) ?? badId(versionId);
    if (invalid) return invalid;

    try {
        const version = await db.toolVersion.findFirst({
            where: { id: versionId, toolId: id },
            select: { id: true },
        });
        if (!version) return errorResponse(404, 'NOT_FOUND', 'Tool version does not exist');

        await db.tool.update({ where: { id }, data: { activeVersionId: versionId } });
        return jsonResponse({ activeVersionId: versionId });
    } catch (error) {
        return prismaError(error, 'Tool version');
    }
}

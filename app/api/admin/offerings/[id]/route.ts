// Route này sửa hoặc xoá một lượt mở môn.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import {
    OfferingConfigurationError,
    validateOfferingConfiguration,
} from '@/lib/admin/offering-configuration';
import { OfferingSchema } from '@/lib/admin/offering-schema';
import { badId, guardDelete, guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/offerings/[id]'>,
): Promise<NextResponse> {
    const guard = await guardWrite(request, OfferingSchema, 'Offering');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        const offering = await db.$transaction(async (tx) => {
            await validateOfferingConfiguration(tx, guard.data, id);
            return tx.offering.update({
                where: { id },
                data: guard.data,
                select: { id: true, subjectId: true, termId: true },
            });
        });
        return jsonResponse({ offering });
    } catch (error) {
        if (error instanceof OfferingConfigurationError) {
            return errorResponse(400, 'VALIDATION_ERROR', error.message, {
                [error.field]: [error.message],
            });
        }
        return prismaError(error, 'Offering', {
            unique: 'This subject is already offered in that term',
        });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/offerings/[id]'>,
): Promise<NextResponse> {
    const guard = await guardDelete(request);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const invalid = badId(id);
    if (invalid) return invalid;

    try {
        await db.offering.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return prismaError(error, 'Offering', {
            inUse: 'This offering has student work and cannot be deleted.',
        });
    }
}

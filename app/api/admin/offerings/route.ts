// Route này tạo một lượt mở môn.
import { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import {
    OfferingConfigurationError,
    validateOfferingConfiguration,
} from '@/lib/admin/offering-configuration';
import { OfferingSchema } from '@/lib/admin/offering-schema';
import { guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardWrite(request, OfferingSchema, 'Offering');
    if (!guard.ok) return guard.response;

    try {
        const offering = await db.$transaction(async (tx) => {
            await validateOfferingConfiguration(tx, guard.data, null);
            return tx.offering.create({
                data: guard.data,
                select: { id: true, subjectId: true, termId: true },
            });
        });
        return jsonResponse({ offering }, { status: 201 });
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

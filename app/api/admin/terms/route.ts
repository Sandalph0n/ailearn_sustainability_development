// Route này tạo kỳ học mới.
import { NextRequest, NextResponse } from 'next/server';

import { jsonResponse } from '@/lib/auth/http/response';
import { guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { TermSchema } from '@/lib/admin/term-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardWrite(request, TermSchema, 'Term');
    if (!guard.ok) return guard.response;

    try {
        const term = await db.studyTerm.create({
            data: guard.data,
            select: { id: true, year: true, session: true },
        });
        return jsonResponse({ term }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Term', {
            unique: 'That year and session already exists at this institution',
        });
    }
}

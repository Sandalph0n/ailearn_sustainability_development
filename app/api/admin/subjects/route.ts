// Route này tạo môn học mới.
import { NextRequest, NextResponse } from 'next/server';

import { jsonResponse } from '@/lib/auth/http/response';
import { guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { SubjectSchema } from '@/lib/admin/subject-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardWrite(request, SubjectSchema, 'Subject');
    if (!guard.ok) return guard.response;

    try {
        const subject = await db.subject.create({
            data: guard.data,
            select: { id: true, subjectCode: true, subjectName: true },
        });
        return jsonResponse({ subject }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Subject', {
            unique: 'That subject code is already used at this institution',
        });
    }
}

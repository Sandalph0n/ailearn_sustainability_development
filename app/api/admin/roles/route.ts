// Route này tạo vai trò mới.
import { NextRequest, NextResponse } from 'next/server';

import { jsonResponse } from '@/lib/auth/http/response';
import { guardWrite, prismaError } from '@/lib/admin/route-helpers';
import { RoleSchema } from '@/lib/admin/role-schema';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const guard = await guardWrite(request, RoleSchema, 'Role');
    if (!guard.ok) return guard.response;

    try {
        const role = await db.role.create({
            data: guard.data,
            select: { id: true, roleName: true },
        });
        return jsonResponse({ role }, { status: 201 });
    } catch (error) {
        return prismaError(error, 'Role');
    }
}

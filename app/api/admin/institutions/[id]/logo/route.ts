// Route này đổi và gỡ logo của một cơ sở, cho quản trị viên toàn hệ thống.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSameOriginRequest } from '@/lib/auth/http/request';
import { errorResponse, invalidOriginResponse } from '@/lib/auth/http/response';
import { requireSystemAdmin } from '@/lib/auth/require-admin';
import { applyLogoRemoval, applyLogoUpload } from '@/lib/storage/logo-actions';

export const runtime = 'nodejs';

/** Kiểm định dạng trước khi chạm database — xem chú thích ở `/api/admin/institutions/[id]`. */
const idSchema = z.uuid();

async function guard(request: NextRequest, id: string) {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const admin = await requireSystemAdmin();
    if (!admin.ok) return admin.response;

    if (!idSchema.safeParse(id).success) {
        return errorResponse(404, 'NOT_FOUND', 'Institution not found');
    }

    return null;
}

export async function PUT(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/institutions/[id]/logo'>,
): Promise<NextResponse> {
    const { id } = await params;
    const denied = await guard(request, id);
    if (denied) return denied;

    return applyLogoUpload(request, id);
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/admin/institutions/[id]/logo'>,
): Promise<NextResponse> {
    const { id } = await params;
    const denied = await guard(request, id);
    if (denied) return denied;

    return applyLogoRemoval(id);
}

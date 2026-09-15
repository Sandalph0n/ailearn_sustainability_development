// Route này tra một mã môn trong danh mục công khai của cơ sở, cho quản trị hệ thống.
import { NextRequest, NextResponse } from 'next/server';

import { invalidOriginResponse } from '@/lib/auth/http/response';
import { isSameOriginRequest } from '@/lib/auth/http/request';
import { requireSystemAdmin } from '@/lib/auth/require-admin';
import { badId } from '@/lib/admin/route-helpers';
import { lookupCatalogSubject } from '@/lib/institution-adapters/lookup';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) return invalidOriginResponse();

    const guard = await requireSystemAdmin();
    if (!guard.ok) return guard.response;

    const institutionId = request.nextUrl.searchParams.get('institutionId') ?? '';
    const invalid = badId(institutionId);
    if (invalid) return invalid;

    return lookupCatalogSubject(institutionId, request.nextUrl.searchParams.get('code'));
}

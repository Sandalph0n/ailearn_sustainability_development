// Route này tra một mã môn trong danh mục công khai của cơ sở, dưới một vai trò trong cơ sở đó.
import { NextRequest, NextResponse } from 'next/server';

import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { lookupCatalogSubject } from '@/lib/institution-adapters/lookup';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/subjects/lookup'>,
): Promise<NextResponse> {
    const { institutionId } = await params;

    // Tra cứu chỉ có ích để tạo môn, nên mượn luôn quyền tạo thay vì đẻ thêm một permission.
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.SUBJECT_CREATE,
    );
    if (!guard.ok) return guard.response;

    return lookupCatalogSubject(institutionId, request.nextUrl.searchParams.get('code'));
}

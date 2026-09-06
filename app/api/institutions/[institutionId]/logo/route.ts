// Route này đổi và gỡ logo của một cơ sở, cho người có quyền trong chính cơ sở đó.
import { NextRequest, NextResponse } from 'next/server';

import { guardInstitutionAction } from '@/lib/auth/institution-route-guard';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { applyLogoRemoval, applyLogoUpload } from '@/lib/storage/logo-actions';

export const runtime = 'nodejs';

export async function PUT(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/logo'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    // `guardInstitutionAction` chứ không phải `guardInstitutionWrite`: cái sau đọc thân request
    // dưới dạng JSON, mà ở đây thân request là byte của một tấm ảnh.
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE,
    );
    if (!guard.ok) return guard.response;

    return applyLogoUpload(request, institutionId);
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext<'/api/institutions/[institutionId]/logo'>,
): Promise<NextResponse> {
    const { institutionId } = await params;
    const guard = await guardInstitutionAction(
        request,
        institutionId,
        PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE,
    );
    if (!guard.ok) return guard.response;

    return applyLogoRemoval(institutionId);
}

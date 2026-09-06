// File này chứa phần THÂN của việc đổi logo, dùng chung cho hai route có hai chốt quyền khác nhau.
import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';

import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { db } from '@/lib/db';
import { MAX_IMAGE_BYTES, readImageUpload } from '@/lib/storage/image';
import { newLogoKey } from '@/lib/storage/keys';
import { removePicture, replacePicture } from '@/lib/storage/pictures';

/**
 * ─── Vì sao tách ra khỏi route ───────────────────────────────────────────────
 *
 * Cùng một việc có hai lối vào, khác nhau ĐÚNG ở chốt quyền:
 *
 *     /api/admin/institutions/<id>/logo    quản trị viên toàn hệ thống
 *     /api/institutions/<id>/logo          người có quyền `institution.settings.update`
 *
 * Chép đôi phần thân thì sớm muộn hai bên lệch — bên này sửa trần kích thước, bên kia quên. Chốt
 * quyền thì KHÔNG dùng chung, vì đó mới là chỗ hai lối vào thật sự khác nhau.
 */
export async function applyLogoUpload(
    request: NextRequest,
    institutionId: string,
): Promise<NextResponse> {
    const upload = await readImageUpload(request);
    if (!upload.ok) {
        return upload.reason === 'too_large'
            ? errorResponse(
                  413,
                  'PAYLOAD_TOO_LARGE',
                  `Logo must be smaller than ${MAX_IMAGE_BYTES / 1024 / 1024}MB`,
              )
            : errorResponse(
                  415,
                  'UNSUPPORTED_CONTENT_TYPE',
                  'Logo must be a PNG, JPEG, GIF or WebP image',
              );
    }

    const institution = await db.institution.findUnique({
        where: { id: institutionId },
        select: { logoKey: true },
    });
    if (!institution) {
        return errorResponse(404, 'NOT_FOUND', 'Institution not found');
    }

    const logoKey = newLogoKey(institutionId);

    await replacePicture({
        previousKey: institution.logoKey,
        nextKey: logoKey,
        bytes: upload.bytes,
        contentType: upload.contentType,
        savePointer: async (key) => {
            await db.institution.update({ where: { id: institutionId }, data: { logoKey: key } });
        },
    });

    return jsonResponse({ logoKey });
}

export async function applyLogoRemoval(institutionId: string): Promise<NextResponse> {
    const institution = await db.institution.findUnique({
        where: { id: institutionId },
        select: { logoKey: true },
    });
    if (!institution) {
        return errorResponse(404, 'NOT_FOUND', 'Institution not found');
    }

    await removePicture({
        previousKey: institution.logoKey,
        savePointer: async (key) => {
            await db.institution.update({ where: { id: institutionId }, data: { logoKey: key } });
        },
    });

    return jsonResponse({ logoKey: null });
}

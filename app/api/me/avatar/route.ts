// Route này đổi và gỡ ảnh đại diện của CHÍNH người đang đăng nhập.
import { NextRequest, NextResponse } from 'next/server';

import { isSameOriginRequest } from '@/lib/auth/http/request';
import { errorResponse, invalidOriginResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';
import { MAX_IMAGE_BYTES, readImageUpload } from '@/lib/storage/image';
import { newAvatarKey } from '@/lib/storage/keys';
import { removePicture, replacePicture } from '@/lib/storage/pictures';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Không có tham số `userId` trên đường dẫn, và đó là chủ ý: không tồn tại cách nào để yêu cầu
 * route này đổi ảnh của người khác. Danh tính lấy từ cookie phiên, không lấy từ URL.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const session = await getCurrentSession();
    if (!session) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    }

    const upload = await readImageUpload(request);
    if (!upload.ok) {
        return upload.reason === 'too_large'
            ? errorResponse(
                  413,
                  'PAYLOAD_TOO_LARGE',
                  `Picture must be smaller than ${MAX_IMAGE_BYTES / 1024 / 1024}MB`,
              )
            : errorResponse(
                  415,
                  'UNSUPPORTED_CONTENT_TYPE',
                  'Picture must be a PNG, JPEG, GIF or WebP image',
              );
    }

    const avatarKey = newAvatarKey(session.user.id);

    await replacePicture({
        previousKey: session.user.avatarKey,
        nextKey: avatarKey,
        bytes: upload.bytes,
        contentType: upload.contentType,
        savePointer: async (key) => {
            await db.user.update({ where: { id: session.user.id }, data: { avatarKey: key } });
        },
    });

    return jsonResponse({ avatarKey });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const session = await getCurrentSession();
    if (!session) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue');
    }

    await removePicture({
        previousKey: session.user.avatarKey,
        savePointer: async (key) => {
            await db.user.update({ where: { id: session.user.id }, data: { avatarKey: key } });
        },
    });

    return jsonResponse({ avatarKey: null });
}

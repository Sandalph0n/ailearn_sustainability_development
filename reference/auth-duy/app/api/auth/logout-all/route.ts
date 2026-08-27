// Route này thu hồi toàn bộ session đang tồn tại của user trên mọi thiết bị.
import { isSameOriginRequest } from '@/lib/auth/http/request';
import { errorResponse, invalidOriginResponse } from '@/lib/auth/http/response';
import { revokeAllCurrentUserSessions } from '@/lib/auth/session/service';

export async function POST(request: Request): Promise<Response> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    const revoked = await revokeAllCurrentUserSessions();
    if (!revoked) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    }

    return new Response(null, { status: 204 });
}

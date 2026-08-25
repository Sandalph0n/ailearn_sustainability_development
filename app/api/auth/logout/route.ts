// Route này thu hồi session của thiết bị hiện tại và xóa cookie đăng nhập.
import { isSameOriginRequest } from '@/lib/auth/http/request';
import { invalidOriginResponse } from '@/lib/auth/http/response';
import { revokeCurrentSession } from '@/lib/auth/session/service';

export async function POST(request: Request): Promise<Response> {
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse();
    }

    await revokeCurrentSession();
    return new Response(null, { status: 204 });
}

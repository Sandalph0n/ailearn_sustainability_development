// Route này đọc cookie, đối chiếu session trong database và trả về user hiện tại.
import { errorResponse, jsonResponse } from '@/lib/auth/http/response';
import { getCurrentSession } from '@/lib/auth/session/service';

export async function GET(): Promise<Response> {
    const currentSession = await getCurrentSession();
    if (!currentSession) {
        return errorResponse(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
    }

    return jsonResponse({
        user: currentSession.user,
        session: { expiresAt: currentSession.session.expiresAt },
    });
}

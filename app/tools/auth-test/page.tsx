// Page này lấy phiên hiện tại ở server rồi truyền vào client test panel.
import AuthTestClient, { type AuthSessionView } from './auth-test-client';

import { getCurrentSession } from '@/lib/auth/session/service';

// Phiên đăng nhập đọc từ cookie nên trang này không bao giờ dựng sẵn được.
export const dynamic = 'force-dynamic';

export default async function AuthTestPage() {
    const currentSession = await getCurrentSession();

    // `Date` không đi qua ranh giới server → client được, phải chuyển sang chuỗi trước.
    const initialSession: AuthSessionView | null = currentSession
        ? {
              user: currentSession.user,
              session: { expiresAt: currentSession.session.expiresAt.toISOString() },
          }
        : null;

    return <AuthTestClient initialSession={initialSession} />;
}

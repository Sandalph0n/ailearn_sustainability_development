// Page này lấy dữ liệu server ban đầu rồi truyền vào client test panel.
import AuthTestClient, { type AuthSessionView, type InstitutionOption } from './auth-test-client';

import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AuthTestPage() {
    const [currentSession, institutions] = await Promise.all([
        getCurrentSession(),
        db.institution.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true },
        }),
    ]);

    const initialSession: AuthSessionView | null = currentSession
        ? {
              user: currentSession.user,
              session: { expiresAt: currentSession.session.expiresAt.toISOString() },
          }
        : null;
    const institutionOptions: InstitutionOption[] = institutions;

    return <AuthTestClient initialSession={initialSession} institutions={institutionOptions} />;
}

import { redirect } from 'next/navigation';

import { RoleManagement } from '@/components/navigation/role-management';
import { getCurrentSession } from '@/lib/auth/session/service';
import { listContextOptions } from '@/lib/context/active-context';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function RoleManagementPage() {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const [contexts, institutions] = await Promise.all([
        listContextOptions(session.user.id),
        db.institution.findMany({
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, website: true },
        }),
    ]);

    return <RoleManagement contexts={contexts} institutions={institutions} />;
}

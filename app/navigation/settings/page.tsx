import { redirect } from 'next/navigation';

import { SecuritySettings } from '@/components/navigation/profile-settings';
import { getCurrentSession } from '@/lib/auth/session/service';

export default async function SettingsPage() {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');
    return <main className="mx-auto w-full max-w-7xl py-7"><header className="mb-7 border-b pb-5"><p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">Account</p><h1 className="font-heading mt-1 text-2xl font-semibold">Security settings</h1><p className="text-muted-foreground mt-1 text-sm">Update your password and control signed-in devices.</p></header><SecuritySettings /></main>;
}

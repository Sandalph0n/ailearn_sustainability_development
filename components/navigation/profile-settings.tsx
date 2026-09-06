'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export function ProfileSettings({ firstName: initialFirstName, lastName: initialLastName, email }: { firstName: string; lastName: string; email: string }) {
    const router = useRouter();
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [pending, setPending] = useState(false);
    async function save() {
        setPending(true);
        const response = await fetch('/api/me/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName, lastName }) });
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        setPending(false);
        if (!response.ok) return toast.error(body.error?.message ?? 'Could not update profile');
        toast.success('Profile updated.'); router.refresh();
    }
    return <section className="max-w-3xl rounded-xl border p-6"><h2 className="font-heading text-lg font-semibold">Identity</h2><p className="text-muted-foreground mt-1 text-sm">Your name is shown beside role assignments, requests and assessment work.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="First name"><Input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></Field><Field label="Last name"><Input value={lastName} onChange={(event) => setLastName(event.target.value)} /></Field><Field label="Email"><Input value={email} disabled /></Field></div><div className="mt-6 flex justify-end border-t pt-5"><Button disabled={pending || !firstName.trim() || !lastName.trim()} onClick={() => void save()}>{pending && <Spinner />}Save changes</Button></div></section>;
}

export function SecuritySettings() {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [pending, setPending] = useState(false);
    async function changePassword() {
        setPending(true);
        const response = await fetch('/api/me/password', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        setPending(false);
        if (!response.ok) return toast.error(body.error?.message ?? 'Could not change password');
        setCurrentPassword(''); setNewPassword(''); toast.success('Password changed. Other sessions were signed out.');
    }
    async function signOutEverywhere() {
        setPending(true); await fetch('/api/auth/logout-all', { method: 'POST' }); router.push('/auth'); router.refresh();
    }
    return <div className="space-y-6"><section className="max-w-3xl rounded-xl border p-6"><h2 className="font-heading text-lg font-semibold">Password</h2><p className="text-muted-foreground mt-1 text-sm">Changing it also closes every other active session.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Current password"><Input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field><Field label="New password"><Input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field></div><div className="mt-6 flex justify-end border-t pt-5"><Button disabled={pending || !currentPassword || newPassword.length < 12} onClick={() => void changePassword()}>{pending && <Spinner />}Change password</Button></div></section><section className="max-w-3xl rounded-xl border p-6"><h2 className="font-heading text-lg font-semibold">Active sessions</h2><p className="text-muted-foreground mt-1 text-sm">Use this if you left the application open on a shared device.</p><Button variant="outline" className="mt-5" disabled={pending} onClick={() => void signOutEverywhere()}>Sign out everywhere</Button></section></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>; }

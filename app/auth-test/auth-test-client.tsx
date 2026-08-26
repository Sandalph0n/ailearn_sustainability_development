// Component này cung cấp form và nút tạm thời để gọi, quan sát các auth API từ browser.
'use client';

import { type FormEvent, useState } from 'react';

export type InstitutionOption = {
    id: string;
    name: string;
};

type AuthUserView = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    institutionId: string;
};

export type AuthSessionView = {
    user: AuthUserView;
    session: {
        expiresAt: string;
    };
};

type ApiResult = {
    action: string;
    status: number;
    ok: boolean;
    body: unknown;
};

type AuthTestClientProps = {
    initialSession: AuthSessionView | null;
    institutions: InstitutionOption[];
};

const inputClassName =
    'mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/10';
const primaryButtonClassName =
    'inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClassName =
    'inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50';

async function sendRequest(path: string, init?: RequestInit): Promise<Omit<ApiResult, 'action'>> {
    const response = await fetch(path, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...init,
    });
    const contentType = response.headers.get('content-type');
    const body = response.status === 204
        ? null
        : contentType?.includes('application/json')
          ? await response.json()
          : await response.text();

    return {
        status: response.status,
        ok: response.ok,
        body,
    };
}

function isAuthSessionView(value: unknown): value is AuthSessionView {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<AuthSessionView>;
    return Boolean(
        candidate.user &&
            typeof candidate.user.id === 'string' &&
            typeof candidate.user.email === 'string' &&
            candidate.session &&
            typeof candidate.session.expiresAt === 'string',
    );
}

export default function AuthTestClient({ initialSession, institutions }: AuthTestClientProps) {
    const [session, setSession] = useState<AuthSessionView | null>(initialSession);
    const [result, setResult] = useState<ApiResult | null>(null);
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const hasInstitutions = institutions.length > 0;

    async function runAction(
        action: string,
        path: string,
        init?: RequestInit,
        sessionEffect: 'refresh' | 'clear' | 'none' = 'none',
    ) {
        setPendingAction(action);

        try {
            const response = await sendRequest(path, init);
            setResult({ action, ...response });

            if (sessionEffect === 'clear' && (response.ok || response.status === 401)) {
                setSession(null);
            }

            if (sessionEffect === 'refresh' && (response.ok || path === '/api/auth/session')) {
                const sessionResponse = path === '/api/auth/session'
                    ? response
                    : await sendRequest('/api/auth/session');
                setSession(
                    sessionResponse.ok && isAuthSessionView(sessionResponse.body) ? sessionResponse.body : null,
                );
            }
        } catch (error) {
            setResult({
                action,
                status: 0,
                ok: false,
                body: {
                    error: error instanceof Error ? error.message : 'Unknown network error',
                },
            });
        } finally {
            setPendingAction(null);
        }
    }

    function handleRegister(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        void runAction(
            'Register',
            '/api/auth/register',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password'),
                    firstName: formData.get('firstName'),
                    lastName: formData.get('lastName'),
                    institutionId: formData.get('institutionId'),
                }),
            },
            'refresh',
        );
    }

    function handleLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        void runAction(
            'Login',
            '/api/auth/login',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password'),
                }),
            },
            'refresh',
        );
    }

    function refreshSession() {
        void runAction('Check session', '/api/auth/session', undefined, 'refresh');
    }

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-amber-300/20 bg-amber-300/5 px-5 py-4 text-sm text-amber-100">
                <p className="font-semibold">Temporary development page</p>
                <p className="mt-1 text-amber-100/70">
                    This page calls the real auth APIs and writes real User and Session rows to PostgreSQL.
                </p>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
                <div className="grid gap-6 md:grid-cols-2">
                    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10 sm:p-6">
                        <div className="mb-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                                New account
                            </p>
                            <h2 className="mt-2 text-xl font-semibold">Register</h2>
                            <p className="mt-1 text-sm text-slate-400">Creates a User, a Session, and a cookie.</p>
                        </div>

                        {!hasInstitutions && (
                            <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-200">
                                No Institution rows exist. Add one with Prisma Studio before testing registration.
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={handleRegister}>
                            <label className="block text-sm font-medium text-slate-300">
                                Institution
                                <select
                                    name="institutionId"
                                    required
                                    disabled={!hasInstitutions}
                                    defaultValue={institutions[0]?.id}
                                    className={inputClassName}
                                >
                                    {institutions.map((institution) => (
                                        <option key={institution.id} value={institution.id}>
                                            {institution.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-300">
                                    First name
                                    <input
                                        name="firstName"
                                        autoComplete="given-name"
                                        required
                                        placeholder="Alex"
                                        className={inputClassName}
                                    />
                                </label>
                                <label className="block text-sm font-medium text-slate-300">
                                    Last name
                                    <input
                                        name="lastName"
                                        autoComplete="family-name"
                                        required
                                        placeholder="Nguyen"
                                        className={inputClassName}
                                    />
                                </label>
                            </div>

                            <label className="block text-sm font-medium text-slate-300">
                                Email
                                <input
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    placeholder="student@example.com"
                                    className={inputClassName}
                                />
                            </label>

                            <label className="block text-sm font-medium text-slate-300">
                                Password
                                <input
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={12}
                                    maxLength={128}
                                    required
                                    placeholder="At least 12 characters"
                                    className={inputClassName}
                                />
                            </label>

                            <button
                                type="submit"
                                disabled={!hasInstitutions || pendingAction !== null}
                                className={`${primaryButtonClassName} w-full`}
                            >
                                {pendingAction === 'Register' ? 'Registering…' : 'Create account'}
                            </button>
                        </form>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10 sm:p-6">
                        <div className="mb-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
                                Existing account
                            </p>
                            <h2 className="mt-2 text-xl font-semibold">Login</h2>
                            <p className="mt-1 text-sm text-slate-400">Verifies credentials and rotates this cookie.</p>
                        </div>

                        <form className="space-y-4" onSubmit={handleLogin}>
                            <label className="block text-sm font-medium text-slate-300">
                                Email
                                <input
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    placeholder="student@example.com"
                                    className={inputClassName}
                                />
                            </label>

                            <label className="block text-sm font-medium text-slate-300">
                                Password
                                <input
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    maxLength={128}
                                    required
                                    placeholder="Your password"
                                    className={inputClassName}
                                />
                            </label>

                            <button
                                type="submit"
                                disabled={pendingAction !== null}
                                className={`${primaryButtonClassName} w-full`}
                            >
                                {pendingAction === 'Login' ? 'Logging in…' : 'Login'}
                            </button>
                        </form>
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                    Database-backed state
                                </p>
                                <h2 className="mt-2 text-xl font-semibold">Current session</h2>
                            </div>
                            <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    session
                                        ? 'bg-emerald-400/15 text-emerald-300'
                                        : 'bg-slate-700/60 text-slate-300'
                                }`}
                            >
                                {session ? 'Authenticated' : 'Anonymous'}
                            </span>
                        </div>

                        {session ? (
                            <dl className="mt-5 space-y-3 text-sm">
                                <div>
                                    <dt className="text-slate-500">User</dt>
                                    <dd className="mt-0.5 font-medium text-white">
                                        {session.user.firstName} {session.user.lastName}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Email</dt>
                                    <dd className="mt-0.5 break-all text-slate-200">{session.user.email}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">User ID</dt>
                                    <dd className="mt-0.5 break-all font-mono text-xs text-slate-400">
                                        {session.user.id}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Expires</dt>
                                    <dd className="mt-0.5 text-slate-200">
                                        {new Date(session.session.expiresAt).toLocaleString()}
                                    </dd>
                                </div>
                            </dl>
                        ) : (
                            <p className="mt-5 text-sm leading-6 text-slate-400">
                                No valid database session was found for the current cookie.
                            </p>
                        )}

                        <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                            <button
                                type="button"
                                onClick={refreshSession}
                                disabled={pendingAction !== null}
                                className={secondaryButtonClassName}
                            >
                                Check
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    void runAction(
                                        'Logout',
                                        '/api/auth/logout',
                                        { method: 'POST' },
                                        'clear',
                                    )
                                }
                                disabled={pendingAction !== null}
                                className={secondaryButtonClassName}
                            >
                                Logout
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    void runAction(
                                        'Logout all',
                                        '/api/auth/logout-all',
                                        { method: 'POST' },
                                        'clear',
                                    )
                                }
                                disabled={pendingAction !== null}
                                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-400/5 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Logout all
                            </button>
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold">Last API response</p>
                                <p className="text-xs text-slate-500">Raw response for manual inspection</p>
                            </div>
                            {result && (
                                <span
                                    className={`rounded-md px-2 py-1 font-mono text-xs ${
                                        result.ok
                                            ? 'bg-emerald-400/10 text-emerald-300'
                                            : 'bg-rose-400/10 text-rose-300'
                                    }`}
                                >
                                    {result.status || 'ERR'}
                                </span>
                            )}
                        </div>
                        <pre className="min-h-48 overflow-auto p-4 font-mono text-xs leading-5 text-slate-300">
                            {result
                                ? `${result.action}\n\n${JSON.stringify(result.body, null, 2)}`
                                : 'Run an auth action to inspect its response.'}
                        </pre>
                    </section>
                </aside>
            </div>
        </div>
    );
}

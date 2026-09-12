// Layout này tạo khung riêng cho trang kiểm thử auth tạm thời.
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Auth Test | Lernumi',
    description: 'Temporary page for manually testing authentication APIs.',
};

export default function AuthTestLayout({ children }: LayoutProps<'/tools/auth-test'>) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <header className="border-b border-white/10 bg-slate-950/90">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">
                            Lernumi
                        </p>
                        <h1 className="mt-1 text-lg font-semibold">Authentication test bench</h1>
                    </div>
                    <Link
                        href="/"
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:bg-white/5 hover:text-white"
                    >
                        Back to home
                    </Link>
                </div>
            </header>

            <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">{children}</main>
        </div>
    );
}

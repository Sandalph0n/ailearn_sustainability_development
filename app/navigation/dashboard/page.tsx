import Link from 'next/link';
import { Shield01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { buttonVariants } from '@/components/ui/button';
import { getCurrentSession } from '@/lib/auth/session/service';
import { resolveActiveContext } from '@/lib/context/active-context';

export default async function DashboardPage({ searchParams }: PageProps<"/navigation/dashboard">) {
	const session = await getCurrentSession();
	const userId = session?.user.id;

	const { active } = userId
		? await resolveActiveContext(userId, await searchParams)
		: { active: null };

	if (active === null) {
		return (
			<main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl items-center py-10 sm:py-16">
				<section className="bg-card flex w-full flex-col gap-6 rounded-xl border p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
					<div className="bg-brand-teal/10 text-brand-teal flex size-11 shrink-0 items-center justify-center rounded-lg">
						<HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="size-5" />
					</div>

					<div className="min-w-0 flex-1">
						<p className="font-heading text-lg font-semibold">No active role yet</p>
						<p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
							Request a role from an institution to access its subjects, offerings and tools.
						</p>
					</div>

					<Link
						href="/navigation/roles"
						className={buttonVariants({ size: 'lg', className: 'self-start sm:self-auto' })}
					>
						Manage roles
					</Link>
				</section>
			</main>
		);
	}

	return <div>DashboardPage</div>;
}

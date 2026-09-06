'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, ReloadIcon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';

export default function OfferingAssessmentsError({ reset }: { reset: () => void }) {
    return (
        <main className="mx-auto flex min-h-[28rem] w-full max-w-7xl items-center py-7">
            <section className="border-border bg-background w-full max-w-xl border p-6">
                <div className="text-destructive flex items-center gap-2">
                    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5" />
                    <h1 className="font-heading text-lg font-semibold">
                        Assessment management could not load
                    </h1>
                </div>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                    Your changes were not submitted. Retry the page, or return to Offerings and
                    choose the subject again.
                </p>
                <Button className="mt-5" variant="outline" onClick={reset}>
                    <HugeiconsIcon icon={ReloadIcon} strokeWidth={2} />
                    Try again
                </Button>
            </section>
        </main>
    );
}

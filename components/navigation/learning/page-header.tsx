import Link from 'next/link';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

type LearningPageHeaderProps = {
    eyebrow?: string;
    title: string;
    description: string;
    back?: { href: string; label: string };
    aside?: React.ReactNode;
};

export function LearningPageHeader({
    eyebrow = 'Learning',
    title,
    description,
    back,
    aside,
}: LearningPageHeaderProps) {
    return (
        <header className="mb-6 border-b pb-5">
            {back && (
                <Link
                    href={back.href}
                    className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
                    {back.label}
                </Link>
            )}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                        {eyebrow}
                    </p>
                    <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                        {title}
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
                        {description}
                    </p>
                </div>
                {aside}
            </div>
        </header>
    );
}

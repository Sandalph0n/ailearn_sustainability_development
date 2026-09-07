'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download01Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function ToolVersionActions({
    toolId,
    versionId,
    active,
}: {
    toolId: string;
    versionId: string;
    active: boolean;
}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);

    async function activate() {
        setPending(true);
        try {
            const response = await fetch(`/api/admin/tools/${toolId}/versions/${versionId}/activate`, {
                method: 'POST',
            });
            if (!response.ok) {
                const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
                toast.error(body.error?.message ?? 'Could not activate this version');
                return;
            }
            toast.success('Active version updated');
            router.refresh();
        } catch {
            toast.error('Cannot reach the server');
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex items-center justify-end gap-2">
            <Link
                href={`/api/admin/tools/${toolId}/versions/${versionId}/download`}
                className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                aria-label="Download original package"
                title="Download package"
            >
                <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
            </Link>
            <Button variant="outline" size="sm" onClick={activate} disabled={active || pending}>
                {pending && <Spinner />}
                {active ? 'Active' : 'Make active'}
            </Button>
        </div>
    );
}

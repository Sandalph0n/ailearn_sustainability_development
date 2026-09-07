'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft01Icon,
    Delete02Icon,
    PencilEdit01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

import { ResourceActionDialog } from '@/components/admin/resource-action-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export function WorkspaceHeader({
    workspaceId,
    initialName,
    personal,
    readOnly,
}: {
    workspaceId: string;
    initialName: string;
    personal: boolean;
    readOnly: boolean;
}) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(initialName);
    const [pending, setPending] = useState(false);

    function cancelEditing() {
        setName(initialName);
        setEditing(false);
    }

    async function renameWorkspace() {
        if (!name.trim() || pending) return;
        setPending(true);
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const body = (await response.json().catch(() => ({}))) as {
                error?: { message?: string };
            };
            if (!response.ok) {
                throw new Error(body.error?.message ?? 'Could not rename workspace');
            }
            setEditing(false);
            toast.success('Workspace renamed.');
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not rename workspace');
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex h-16 min-w-0 items-center gap-2">
            <Button
                nativeButton={false}
                variant="ghost"
                size="icon-sm"
                render={<Link href="/navigation/workspaces" />}
                aria-label="Back to workspaces"
            >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>

            <div className="bg-border h-6 w-px shrink-0" />

            {editing ? (
                <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-8 min-w-0 max-w-lg flex-1"
                    maxLength={120}
                    autoFocus
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') void renameWorkspace();
                        if (event.key === 'Escape') cancelEditing();
                    }}
                />
            ) : (
                <div className="min-w-0 flex-1">
                    <h1 className="font-heading truncate text-sm font-semibold tracking-tight md:text-base">
                        {initialName}
                    </h1>
                    <p className="text-muted-foreground hidden truncate text-xs sm:block">
                        {personal
                            ? 'Personal workspace · activity is not recorded'
                            : readOnly
                              ? 'Submitted assessment workspace · read-only'
                              : 'Assessment workspace · changes remain available until submission'}
                    </p>
                </div>
            )}

            <div className="flex shrink-0 items-center gap-1">
                {!readOnly &&
                    (editing ? (
                        <>
                            <Button variant="ghost" size="sm" disabled={pending} onClick={cancelEditing}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!name.trim() || pending}
                                onClick={() => void renameWorkspace()}
                            >
                                {pending && <Spinner />}
                                Save
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                            <span className="hidden xl:inline">Rename</span>
                        </Button>
                    ))}

                {personal && !editing && (
                    <ResourceActionDialog
                        endpoint={`/api/workspaces/${workspaceId}`}
                        method="DELETE"
                        title={`Delete ${initialName}?`}
                        description="The workspace, every folder and every uploaded file will be permanently deleted."
                        confirmLabel="Delete workspace"
                        destructive
                        onCompleted={() => router.push('/navigation/workspaces')}
                        trigger={
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                aria-label="Delete workspace"
                            >
                                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                            </Button>
                        }
                    />
                )}
            </div>
        </div>
    );
}

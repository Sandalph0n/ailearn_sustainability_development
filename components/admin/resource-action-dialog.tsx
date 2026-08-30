'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';

/** Xác nhận một chuyển trạng thái như approve, reject hoặc revoke; không giả thành thao tác xoá. */
export function ResourceActionDialog({
    endpoint,
    method = 'POST',
    title,
    description,
    confirmLabel,
    destructive = false,
    trigger,
}: {
    endpoint: string;
    method?: 'POST' | 'PATCH';
    title: string;
    description: ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    trigger: ReactElement;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function confirm() {
        setWorking(true);
        setError(null);
        try {
            const response = await fetch(endpoint, { method });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setError(body?.error?.message ?? 'Could not complete this action.');
                setWorking(false);
                return;
            }
        } catch {
            setError('Cannot reach the server. Check your connection.');
            setWorking(false);
            return;
        }

        setWorking(false);
        setOpen(false);
        router.refresh();
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setError(null);
            }}
        >
            <AlertDialogTrigger nativeButton={false} render={trigger} />
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                {error && (
                    <div
                        role="alert"
                        className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
                    >
                        {error}
                    </div>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={working}
                        onClick={(event) => {
                            event.preventDefault();
                            void confirm();
                        }}
                    >
                        {working && <Spinner />}
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

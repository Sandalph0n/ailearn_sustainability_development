'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckmarkCircle02Icon, SourceCodeIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

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
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type ErrorPayload = { error?: { message?: string } };

async function responseMessage(response: Response, fallback: string): Promise<string> {
    const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
    return payload?.error?.message ?? fallback;
}

export function StartAttemptButton({
    endpoint,
    assessmentId,
    attemptBasePath,
    contextQuery,
    disabled = false,
}: {
    endpoint: string;
    assessmentId: string;
    attemptBasePath: string;
    contextQuery: string;
    disabled?: boolean;
}) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    async function start() {
        setSubmitting(true);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assessmentId }),
            });
            if (!response.ok) throw new Error(await responseMessage(response, 'Could not start attempt'));

            const payload = (await response.json()) as { attempt: { id: string } };
            toast.success('New attempt started');
            router.push(`${attemptBasePath}/${payload.attempt.id}?${contextQuery}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not start attempt');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Button disabled={disabled || submitting} onClick={() => void start()}>
            {submitting && <Spinner />}
            Start new attempt
        </Button>
    );
}

export function SubmitAttemptButton({ endpoint }: { endpoint: string }) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [open, setOpen] = useState(false);

    async function submit() {
        setSubmitting(true);
        try {
            const response = await fetch(endpoint, { method: 'POST' });
            if (!response.ok) throw new Error(await responseMessage(response, 'Could not submit attempt'));
            toast.success('Attempt submitted');
            setOpen(false);
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not submit attempt');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger
                render={
                    <Button disabled={submitting}>
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                        Submit attempt
                    </Button>
                }
            />
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Submit this attempt?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Submission is final. This attempt becomes read-only, but you may start a
                        separate attempt afterwards.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={submitting}>Keep working</AlertDialogCancel>
                    <AlertDialogAction disabled={submitting} onClick={() => void submit()}>
                        {submitting && <Spinner />}
                        Submit
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function LaunchToolButton({
    attemptId,
    tool,
    roleAssignmentId,
}: {
    attemptId: string;
    tool: { id: string; name: string };
    roleAssignmentId: string;
}) {
    const [launching, setLaunching] = useState(false);

    async function launch() {
        setLaunching(true);
        try {
            const response = await fetch('/api/tool/v1/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'WORK',
                    attemptId,
                    toolId: tool.id,
                    roleAssignmentId,
                }),
            });
            if (!response.ok) throw new Error(await responseMessage(response, `Could not open ${tool.name}`));
            const payload = (await response.json()) as { runtimeUrl: string };
            window.location.assign(payload.runtimeUrl);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Could not open ${tool.name}`);
        } finally {
            setLaunching(false);
        }
    }

    return (
        <Button className="w-full justify-start" disabled={launching} onClick={() => void launch()}>
            {launching ? <Spinner /> : <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} />}
            Open {tool.name}
        </Button>
    );
}

'use client';

import { useState } from 'react';
import { SourceCodeIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type ErrorPayload = { error?: { message?: string } };

export function LaunchReplayButton({
    workSessionId,
    roleAssignmentId,
    toolName,
}: {
    workSessionId: string;
    roleAssignmentId: string;
    toolName: string;
}) {
    const [launching, setLaunching] = useState(false);

    async function launch() {
        setLaunching(true);
        try {
            const response = await fetch('/api/tool/v1/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'REPLAY',
                    workSessionId,
                    roleAssignmentId,
                }),
            });
            const payload = (await response.json().catch(() => null)) as
                | { runtimeUrl?: string; error?: ErrorPayload['error'] }
                | null;
            if (!response.ok || !payload?.runtimeUrl) {
                throw new Error(payload?.error?.message ?? `Could not open ${toolName} replay`);
            }
            window.location.assign(payload.runtimeUrl);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Could not open ${toolName} replay`);
            setLaunching(false);
        }
    }

    return (
        <Button size="sm" variant="outline" disabled={launching} onClick={() => void launch()}>
            {launching ? <Spinner /> : <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} />}
            Open replay
        </Button>
    );
}

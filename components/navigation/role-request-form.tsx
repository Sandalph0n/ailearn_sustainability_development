'use client';

import { useEffect, useState } from 'react';
import { ArrowRight01Icon, UniversityIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@/components/ui/combobox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

export type InstitutionRequestOption = {
    id: string;
    name: string;
    website: string | null;
};

type RoleOption = {
    id: string;
    roleName: string;
    scopeType: 'INSTITUTION' | 'OFFERING';
    pending: boolean;
};

function errorMessage(body: unknown, fallback: string): string {
    if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'object' &&
        body.error !== null &&
        'message' in body.error &&
        typeof body.error.message === 'string'
    ) {
        return body.error.message;
    }
    return fallback;
}

function isRoleOption(value: unknown): value is RoleOption {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        typeof value.id === 'string' &&
        'roleName' in value &&
        typeof value.roleName === 'string' &&
        'scopeType' in value &&
        (value.scopeType === 'INSTITUTION' || value.scopeType === 'OFFERING') &&
        'pending' in value &&
        typeof value.pending === 'boolean'
    );
}

export function RoleRequestForm({
    institutions,
}: {
    institutions: InstitutionRequestOption[];
}) {
    const [institution, setInstitution] = useState<InstitutionRequestOption | null>(null);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [roleId, setRoleId] = useState<string | null>(null);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!institution) return;

        const controller = new AbortController();

        void (async () => {
            try {
                const response = await fetch(
                    `/api/role-requests?institutionId=${encodeURIComponent(institution.id)}`,
                    { signal: controller.signal, cache: 'no-store' },
                );
                const body: unknown = await response.json().catch(() => ({}));

                if (!response.ok) {
                    setError(errorMessage(body, 'Could not load roles for this institution.'));
                    return;
                }

                const nextRoles =
                    typeof body === 'object' &&
                    body !== null &&
                    'roles' in body &&
                    Array.isArray(body.roles)
                        ? body.roles.filter(isRoleOption)
                        : [];
                setRoles(nextRoles);
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === 'AbortError') return;
                setError('Cannot reach the server. Check your connection.');
            } finally {
                if (!controller.signal.aborted) setLoadingRoles(false);
            }
        })();

        return () => controller.abort();
    }, [institution]);

    function chooseInstitution(value: InstitutionRequestOption | null) {
        setInstitution(value);
        setRoleId(null);
        setRoles([]);
        setError(null);
        setLoadingRoles(value !== null);
    }

    async function submitRequest() {
        if (!institution || !roleId || submitting) return;

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/role-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ institutionId: institution.id, roleId }),
            });
            const body: unknown = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = errorMessage(body, 'Could not send your role request.');
                setError(message);
                toast.error(message);
                return;
            }

            const requestedRole = roles.find((role) => role.id === roleId);
            setRoles((current) =>
                current.map((role) => (role.id === roleId ? { ...role, pending: true } : role)),
            );
            setRoleId(null);
            toast.success(
                requestedRole
                    ? `${requestedRole.roleName} request sent for review.`
                    : 'Role request sent for review.',
            );
        } catch {
            const message = 'Cannot reach the server. Check your connection.';
            setError(message);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    }

    const rolePlaceholder = !institution
        ? 'Choose an institution first'
        : loadingRoles
          ? 'Loading available roles…'
          : roles.length === 0
            ? 'No roles are available to request'
            : 'Choose a role';

    return (
        <div className="p-8 sm:p-10">
            <div className="mb-8 flex items-start gap-3">
                <div className="bg-brand-teal/10 text-brand-teal mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <HugeiconsIcon icon={UniversityIcon} strokeWidth={2} className="size-5" />
                </div>
                <div>
                    <h2 className="font-heading text-xl font-semibold">Request a role</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Start by finding your institution.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label htmlFor="institution" className="text-sm font-medium">
                        Institution
                    </label>
                    <Combobox
                        items={institutions}
                        value={institution}
                        onValueChange={chooseInstitution}
                        itemToStringLabel={(item: InstitutionRequestOption) => item.name}
                        itemToStringValue={(item: InstitutionRequestOption) => item.id}
                        isItemEqualToValue={(
                            item: InstitutionRequestOption,
                            value: InstitutionRequestOption,
                        ) => item.id === value.id}
                    >
                        <ComboboxInput
                            id="institution"
                            className="w-full"
                            placeholder="Search by institution name"
                            autoComplete="organization"
                            showClear
                        />
                        <ComboboxContent>
                            <ComboboxEmpty>No institution found.</ComboboxEmpty>
                            <ComboboxList>
                                {(item: InstitutionRequestOption) => (
                                    <ComboboxItem key={item.id} value={item}>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">{item.name}</span>
                                            {item.website && (
                                                <span className="text-muted-foreground truncate text-xs">
                                                    {item.website}
                                                </span>
                                            )}
                                        </span>
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                    <p className="text-muted-foreground text-xs">
                        All institutions registered with AI-Learn are searchable here.
                    </p>
                </div>

                <div className="space-y-2">
                    <label htmlFor="requested-role" className="text-sm font-medium">
                        Requested role
                    </label>
                    <Select
                        value={roleId}
                        onValueChange={(value) => setRoleId(value)}
                        disabled={!institution || loadingRoles || roles.length === 0}
                    >
                        <SelectTrigger id="requested-role" className="w-full">
                            {loadingRoles && <Spinner />}
                            <SelectValue placeholder={rolePlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id} disabled={role.pending}>
                                    <span>{role.roleName}</span>
                                    <span className="text-muted-foreground text-xs">
                                        {role.scopeType === 'INSTITUTION'
                                            ? 'Institution'
                                            : 'Offering · scope assigned later'}
                                    </span>
                                    {role.pending && (
                                        <span className="text-muted-foreground text-xs">Pending</span>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {error && (
                    <p
                        role="alert"
                        className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
                    >
                        {error}
                    </p>
                )}

                <Button
                    type="button"
                    disabled={!institution || !roleId || loadingRoles || submitting}
                    className="mt-1 w-full sm:w-auto"
                    onClick={() => void submitRequest()}
                >
                    {submitting && <Spinner />}
                    Send request
                    <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        data-icon="inline-end"
                    />
                </Button>
            </div>

            <p className="text-muted-foreground border-border/70 mt-8 border-t pt-5 text-xs leading-5">
                Submitting a request does not grant access immediately. The institution controls
                approval and can revoke an assigned role later.
            </p>
        </div>
    );
}

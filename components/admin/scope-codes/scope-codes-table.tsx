'use client';

import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    Copy01Icon,
    Delete02Icon,
} from '@hugeicons/core-free-icons';
import { toast } from 'sonner';

import { ResourceActionDialog } from '@/components/admin/resource-action-dialog';
import {
    ResourceFormPage,
    ResourceFormSection,
} from '@/components/admin/resource-form-page';
import type { ScopeCodeCapabilities } from '@/components/admin/scope-codes/scope-codes-section';
import { FormSelect } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
import { SelectItem } from '@/components/ui/select';
import {
    EMPTY_SCOPE_CODE_FORM,
    ScopeCodeSchema,
    type ScopeCodeFormValue,
    type ScopeCodeSchemaValue,
} from '@/lib/admin/scope-code-schema';

type Person = { firstName: string; lastName: string; email: string };
type OfferingOption = {
    id: string;
    subject: { subjectCode: string; subjectName: string };
    term: { year: number; session: number };
};

export type ScopeCodeListItem = {
    id: string;
    created: string;
    used: string | null;
    revoked: string | null;
    offering: OfferingOption;
    createdBy: Person;
    usedBy: Person | null;
    usedByRole: string | null;
};

const column = columnHelperFor<ScopeCodeListItem>();

function offeringLabel(offering: OfferingOption): string {
    return `${offering.subject.subjectCode} · ${offering.term.year} S${offering.term.session}`;
}

function personLabel(person: Person): string {
    return `${person.firstName} ${person.lastName}`;
}

export function ScopeCodesTable({
    codes,
    offerings,
    endpoint,
    contextQuery,
    capabilities,
}: {
    codes: ScopeCodeListItem[];
    offerings: OfferingOption[];
    endpoint: string;
    contextQuery: string;
    capabilities: ScopeCodeCapabilities;
}) {
    const [creating, setCreating] = useState(false);
    const columns = useMemo(
        () =>
            [
                column.accessor((row) => offeringLabel(row.offering), {
                    id: 'offering',
                    header: 'Offering',
                    cell: (info) => (
                        <span className="grid gap-0.5">
                            <span className="font-medium">{info.getValue()}</span>
                            <span className="text-muted-foreground text-xs">
                                {info.row.original.offering.subject.subjectName}
                            </span>
                        </span>
                    ),
                }),
                column.accessor('id', {
                    header: 'One-time code',
                    cell: (info) => (
                        <div className="flex items-center gap-2">
                            <code className="bg-muted max-w-52 truncate rounded px-1.5 py-1 font-mono text-xs">
                                {info.getValue()}
                            </code>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Copy access code"
                                disabled={Boolean(info.row.original.used || info.row.original.revoked)}
                                onClick={() => void copyCode(info.getValue())}
                            >
                                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                            </Button>
                        </div>
                    ),
                }),
                column.accessor((row) => personLabel(row.createdBy), {
                    id: 'createdBy',
                    header: 'Created by',
                    cell: (info) => (
                        <span className="grid gap-0.5 text-sm">
                            <span>{info.getValue()}</span>
                            <span className="text-muted-foreground text-xs tabular-nums">
                                {info.row.original.created}
                            </span>
                        </span>
                    ),
                }),
                column.accessor((row) => row.usedBy ? personLabel(row.usedBy) : null, {
                    id: 'usedBy',
                    header: 'Usage',
                    cell: (info) =>
                        info.row.original.used ? (
                            <span className="grid gap-0.5 text-sm">
                                <span>{info.getValue() ?? 'Scope later removed'}</span>
                                <span className="text-muted-foreground text-xs">
                                    {info.row.original.usedByRole
                                        ? `${info.row.original.usedByRole} · `
                                        : ''}
                                    {info.row.original.used}
                                </span>
                            </span>
                        ) : info.row.original.revoked ? (
                            <span className="grid gap-0.5 text-sm">
                                <Badge variant="secondary" className="w-fit">Revoked</Badge>
                                <span className="text-muted-foreground text-xs tabular-nums">
                                    {info.row.original.revoked}
                                </span>
                            </span>
                        ) : (
                            <Badge variant="outline">Available</Badge>
                        ),
                }),
                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) =>
                        capabilities.revoke &&
                        !info.row.original.used &&
                        !info.row.original.revoked ? (
                            <ResourceActionDialog
                                endpoint={endpointFor(
                                    `${endpoint}/${info.row.original.id}`,
                                    contextQuery,
                                )}
                                method="DELETE"
                                title="Revoke this access code?"
                                description={`The unused code for ${offeringLabel(info.row.original.offering)} will stop working immediately.`}
                                confirmLabel="Revoke code"
                                destructive
                                trigger={
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-destructive"
                                        aria-label="Revoke access code"
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                    </Button>
                                }
                            />
                        ) : null,
                }),
            ] as Array<AdminColumnDef<ScopeCodeListItem>>,
        [capabilities.revoke, contextQuery, endpoint],
    );

    if (creating) {
        return (
            <ResourceFormPage<ScopeCodeFormValue, ScopeCodeSchemaValue>
                schema={ScopeCodeSchema}
                emptyValues={EMPTY_SCOPE_CODE_FORM}
                createEndpoint={endpointFor(endpoint, contextQuery)}
                title={{ create: 'New one-time access code', edit: 'Access code' }}
                description={{
                    create: 'Generate a code that grants one offering scope to an existing offering role.',
                    edit: 'Access codes are immutable.',
                }}
                submitLabel={{ create: 'Generate code', edit: 'Save' }}
                onCancel={() => setCreating(false)}
            >
                {(form) => (
                    <ResourceFormSection
                        title="Target offering"
                        description="The code can be redeemed once. It cannot grant a role identity by itself."
                    >
                        <div className="max-w-2xl">
                            <FormSelect
                                control={form.control}
                                name="offeringId"
                                label="Offering"
                                items={Object.fromEntries(
                                    offerings.map((offering) => [
                                        offering.id,
                                        offeringLabel(offering),
                                    ]),
                                )}
                            >
                                {offerings.map((offering) => (
                                    <SelectItem key={offering.id} value={offering.id}>
                                        {offeringLabel(offering)} · {offering.subject.subjectName}
                                    </SelectItem>
                                ))}
                            </FormSelect>
                        </div>
                    </ResourceFormSection>
                )}
            </ResourceFormPage>
        );
    }

    return (
        <DataTable
            columns={columns}
            data={codes}
            filterColumnId="offering"
            filterPlaceholder="Search offerings…"
            emptyMessage={
                capabilities.view
                    ? 'No access codes have been generated yet.'
                    : 'You may generate access codes, but cannot inspect existing codes.'
            }
            toolbar={
                capabilities.create ? (
                    <Button
                        onClick={() => setCreating(true)}
                        disabled={offerings.length === 0}
                    >
                        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                        New access code
                    </Button>
                ) : null
            }
        />
    );
}

async function copyCode(code: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(code);
        toast.success('Access code copied.');
    } catch {
        toast.error('Could not copy the access code.');
    }
}

function endpointFor(path: string, query: string): string {
    return query ? `${path}?${query}` : path;
}

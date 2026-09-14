'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    Delete02Icon,
    Edit02Icon,
    MoreVerticalIcon,
    SourceCodeIcon,
} from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import { FormCheckboxList } from '@/components/admin/form-checkbox-list';
import {
    ResourceFormPage,
    ResourceFormSection,
} from '@/components/admin/resource-form-page';
import { FormCheckbox, FormInput, FormTextarea } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AssessmentSchema,
    EMPTY_ASSESSMENT_FORM,
    type AssessmentFormValue,
    type AssessmentSchemaValue,
} from '@/lib/admin/assessment-schema';
import {
    FULL_CRUD_CAPABILITIES,
    type CrudCapabilities,
} from '@/lib/admin/resource-capabilities';

type ToolOption = { id: string; code: string; name: string; description: string | null };

export type AssessmentListItem = {
    id: string;
    name: string;
    description: string | null;
    weight: number;
    hurdle: boolean;
    isGroup: boolean;
    publishAt: string | null;
    dueAt: string | null;
    expectedDue: string | null;
    published: string | null;
    due: string | null;
    tools: Array<{ id: string; code: string; name: string }>;
    attempts: number;
};

const column = columnHelperFor<AssessmentListItem>();

function toLocalInput(iso: string): string {
    const date = new Date(iso);
    const part = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function AssessmentsTable({
    assessments,
    offeringId,
    tools,
    totalWeight,
    endpoint = `/api/admin/offerings/${offeringId}/assessments`,
    contextQuery,
    capabilities = FULL_CRUD_CAPABILITIES,
    emptyMessage,
    canReviewAttempts = false,
}: {
    assessments: AssessmentListItem[];
    offeringId: string;
    tools: ToolOption[];
    totalWeight: number;
    endpoint?: string;
    contextQuery?: string;
    capabilities?: CrudCapabilities;
    emptyMessage?: string;
    canReviewAttempts?: boolean;
}) {
    const complete = Math.abs(totalWeight - 100) < 1e-9;
    const [editing, setEditing] = useState<AssessmentListItem | 'create' | null>(null);

    const columns = useMemo(
        () =>
            [
                column.accessor('name', {
                    header: 'Assessment',
                    cell: (info) => (
                        <div className="flex max-w-sm flex-col gap-0.5">
                            <span className="font-medium">{info.getValue()}</span>
                            {info.row.original.description && (
                                <span className="text-muted-foreground line-clamp-1 text-xs">
                                    {info.row.original.description}
                                </span>
                            )}
                        </div>
                    ),
                }),
                column.accessor('weight', {
                    header: 'Weight',
                    cell: (info) => (
                        <span className="font-medium tabular-nums">{info.getValue()}%</span>
                    ),
                }),
                column.accessor('due', {
                    header: 'Due',
                    cell: (info) => {
                        const assessment = info.row.original;

                        return (
                            <div className="flex max-w-64 flex-col text-sm">
                                <span className={assessment.due ? 'tabular-nums' : undefined}>
                                    {assessment.due ?? assessment.expectedDue ?? 'Not specified'}
                                </span>
                                {assessment.due && assessment.expectedDue && (
                                    <span className="text-muted-foreground line-clamp-1 text-xs">
                                        Expected: {assessment.expectedDue}
                                    </span>
                                )}
                                <span className="text-muted-foreground text-xs">
                                    {assessment.published
                                        ? `Published ${assessment.published}`
                                        : 'Not published'}
                                </span>
                            </div>
                        );
                    },
                }),
                column.accessor((row) => row.tools.map((tool) => tool.name).join(', '), {
                    id: 'tools',
                    header: 'Tools',
                    enableSorting: false,
                    cell: (info) => (
                        <span className="text-muted-foreground line-clamp-2 max-w-48 text-sm">
                            {info.getValue() || 'None'}
                        </span>
                    ),
                }),
                column.accessor('attempts', {
                    header: 'Attempts',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),
                column.display({
                    id: 'flags',
                    header: '',
                    cell: (info) => (
                        <div className="flex flex-wrap gap-1">
                            {info.row.original.hurdle && <Badge variant="outline">Hurdle</Badge>}
                            {info.row.original.isGroup && <Badge variant="secondary">Group</Badge>}
                        </div>
                    ),
                }),
                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => (
                        <AssessmentActions
                            assessment={info.row.original}
                            endpoint={endpoint}
                            contextQuery={contextQuery}
                            capabilities={capabilities}
                            reviewHref={
                                canReviewAttempts && info.row.original.attempts > 0
                                    ? `/navigation/institution/offerings/${offeringId}/assessments/${info.row.original.id}/attempts${contextQuery ? `?${contextQuery}` : ''}`
                                    : undefined
                            }
                            onEdit={() => setEditing(info.row.original)}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<AssessmentListItem>>,
        [canReviewAttempts, capabilities, contextQuery, endpoint, offeringId],
    );

    if (editing) {
        return (
            <AssessmentForm
                endpoint={endpoint}
                tools={tools}
                assessment={editing === 'create' ? undefined : editing}
                totalWeight={totalWeight}
                contextQuery={contextQuery}
                onCancel={() => setEditing(null)}
            />
        );
    }

    return (
        <DataTable
            columns={columns}
            data={assessments}
            pageSize={20}
            emptyMessage={
                emptyMessage ??
                "No assessments yet. Add the first item in this offering's grading plan."
            }
            toolbar={
                <>
                    <Badge variant={complete ? 'default' : 'secondary'}>
                        {totalWeight}% of 100% allocated
                    </Badge>
                    {!complete && (
                        <span className="text-muted-foreground text-sm">
                            The grading plan is still incomplete.
                        </span>
                    )}
                    <div className="flex-1" />
                    {capabilities.create && (
                        <Button
                            disabled={totalWeight >= 100}
                            onClick={() => setEditing('create')}
                        >
                            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                            New assessment
                        </Button>
                    )}
                </>
            }
        />
    );
}

function AssessmentForm({
    endpoint,
    tools,
    assessment,
    totalWeight,
    contextQuery,
    onCancel,
}: {
    endpoint: string;
    tools: ToolOption[];
    assessment?: AssessmentListItem;
    totalWeight: number;
    contextQuery?: string;
    onCancel: () => void;
}) {
    const maximumWeight = 100 - totalWeight + (assessment?.weight ?? 0);
    const schema = useMemo(
        () =>
            AssessmentSchema.superRefine((value, context) => {
                if (value.weight > maximumWeight + Number.EPSILON) {
                    context.addIssue({
                        code: 'custom',
                        message: `Weight must not exceed ${maximumWeight}% with the current grading plan`,
                        path: ['weight'],
                    });
                }
            }),
        [maximumWeight],
    );

    return (
        <ResourceFormPage<AssessmentFormValue, AssessmentSchemaValue>
            schema={schema}
            emptyValues={EMPTY_ASSESSMENT_FORM}
            editing={
                assessment && {
                    id: assessment.id,
                    values: {
                        name: assessment.name,
                        description: assessment.description ?? '',
                        weight: String(assessment.weight),
                        hurdle: assessment.hurdle,
                        isGroup: assessment.isGroup,
                        publishAt: assessment.publishAt
                            ? toLocalInput(assessment.publishAt)
                            : '',
                        dueAt: assessment.dueAt ? toLocalInput(assessment.dueAt) : '',
                        expectedDue: assessment.expectedDue ?? '',
                        toolIds: assessment.tools.map((tool) => tool.id),
                    } as AssessmentFormValue,
                }
            }
            createEndpoint={endpointFor(endpoint, contextQuery)}
            editEndpoint={
                assessment
                    ? endpointFor(`${endpoint}/${assessment.id}`, contextQuery)
                    : undefined
            }
            title={{ create: 'New assessment', edit: 'Edit assessment' }}
            description={{
                create: 'Add one item to this offering’s grading plan.',
                edit: 'Update dates, weight, flags and allowed tools.',
            }}
            onCancel={onCancel}
        >
            {(form) => (
                <div className="flex flex-col">
                    <ResourceFormSection
                        title="Assessment details"
                        description="Define what students submit and how much it contributes to the final result."
                    >
                        <div className="grid gap-5 md:grid-cols-2">
                            <FormInput
                                control={form.control}
                                name="name"
                                label="Name"
                                placeholder="Project report"
                                autoComplete="off"
                            />
                            <FormInput
                                control={form.control}
                                name="weight"
                                label="Weight (%)"
                                description="The offering total may not exceed 100%."
                                type="number"
                                min="0.01"
                                max={maximumWeight}
                                step="0.01"
                                inputMode="decimal"
                            />
                            <div className="md:col-span-2">
                                <FormTextarea
                                    control={form.control}
                                    name="description"
                                    label="Description"
                                    description="Optional."
                                    placeholder="What students are expected to submit."
                                    rows={3}
                                />
                            </div>
                        </div>
                    </ResourceFormSection>

                    <ResourceFormSection
                        title="Schedule"
                        description="Keep approximate guidance alongside exact publish and due times when they are known."
                    >
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            <FormInput
                                control={form.control}
                                name="publishAt"
                                label="Publish at"
                                description="Optional. Blank means unpublished."
                                type="datetime-local"
                            />
                            <FormInput
                                control={form.control}
                                name="expectedDue"
                                label="Expected due"
                                description="Optional free-form guidance."
                                placeholder="Week 6, during class"
                                autoComplete="off"
                            />
                            <FormInput
                                control={form.control}
                                name="dueAt"
                                label="Due at"
                                description="Optional exact date and time."
                                type="datetime-local"
                            />
                        </div>
                    </ResourceFormSection>

                    <ResourceFormSection
                        title="Rules and tools"
                        description="Set assessment-wide rules, then choose the embedded tools available to students."
                    >
                        <div className="grid gap-6 xl:grid-cols-[minmax(16rem,0.7fr)_minmax(20rem,1.3fr)]">
                            <div className="flex flex-col gap-5">
                                <FormCheckbox
                                    control={form.control}
                                    name="hurdle"
                                    label="Hurdle requirement"
                                    description="Failing this item can fail the subject regardless of total marks."
                                />
                                <FormCheckbox
                                    control={form.control}
                                    name="isGroup"
                                    label="Group assessment"
                                    description="One attempt may represent work from several students."
                                />
                            </div>
                            <FormCheckboxList
                                control={form.control}
                                name="toolIds"
                                label="Allowed tools"
                                description="No selection means no embedded tool."
                                emptyMessage="No tools have been registered by the platform yet."
                                options={tools.map((tool) => ({
                                    value: tool.id,
                                    label: tool.name,
                                    description: tool.description ?? tool.code,
                                }))}
                            />
                        </div>
                    </ResourceFormSection>
                </div>
            )}
        </ResourceFormPage>
    );
}

function AssessmentActions({
    assessment,
    endpoint,
    contextQuery,
    capabilities,
    onEdit,
    reviewHref,
}: {
    assessment: AssessmentListItem;
    endpoint: string;
    contextQuery?: string;
    capabilities: CrudCapabilities;
    onEdit: () => void;
    reviewHref?: string;
}) {
    if (!capabilities.update && !capabilities.delete && !reviewHref) return null;

    return (
        <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button variant="ghost" size="icon-sm" aria-label="Open actions">
                            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                        </Button>
                    }
                />
                <DropdownMenuContent align="end">
                    {reviewHref && (
                        <DropdownMenuItem render={<Link href={reviewHref} />}>
                            <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} />
                            Review attempts
                        </DropdownMenuItem>
                    )}
                    {reviewHref && (capabilities.update || capabilities.delete) && (
                        <DropdownMenuSeparator />
                    )}
                    {capabilities.update && (
                        <DropdownMenuItem onClick={onEdit}>
                            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                            Edit
                        </DropdownMenuItem>
                    )}
                    {capabilities.update && capabilities.delete && <DropdownMenuSeparator />}
                    {capabilities.delete && (
                        <DeleteResourceDialog
                            endpoint={endpointFor(
                                `${endpoint}/${assessment.id}`,
                                contextQuery,
                            )}
                            title={`Delete ${assessment.name}?`}
                            description={
                                assessment.attempts > 0
                                    ? `This assessment has ${assessment.attempts} attempt${assessment.attempts === 1 ? '' : 's'}, so the database will refuse to delete it.`
                                    : 'No student attempts exist. This cannot be undone.'
                            }
                            trigger={
                                <DropdownMenuItem variant="destructive" closeOnClick={false}>
                                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                    Delete
                                </DropdownMenuItem>
                            }
                        />
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function endpointFor(path: string, query = ''): string {
    return query ? `${path}?${query}` : path;
}

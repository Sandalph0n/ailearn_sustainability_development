'use client';

import { useMemo, type ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    Delete02Icon,
    Edit02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';

import { DeleteResourceDialog } from '@/components/admin/delete-resource-dialog';
import { FormCheckboxList } from '@/components/admin/form-checkbox-list';
import { ResourceFormDialog } from '@/components/admin/resource-form-dialog';
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

type ToolOption = { id: string; code: string; name: string; description: string | null };

export type AssessmentListItem = {
    id: string;
    name: string;
    description: string | null;
    weight: number;
    hurdle: boolean;
    isGroup: boolean;
    publishAt: string | null;
    dueAt: string;
    published: string | null;
    due: string;
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
}: {
    assessments: AssessmentListItem[];
    offeringId: string;
    tools: ToolOption[];
    totalWeight: number;
}) {
    const endpoint = `/api/admin/offerings/${offeringId}/assessments`;
    const complete = Math.abs(totalWeight - 100) < 1e-9;

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
                    cell: (info) => (
                        <div className="flex flex-col text-sm tabular-nums">
                            <span>{info.getValue()}</span>
                            <span className="text-muted-foreground text-xs">
                                {info.row.original.published
                                    ? `Published ${info.row.original.published}`
                                    : 'Not published'}
                            </span>
                        </div>
                    ),
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
                            tools={tools}
                        />
                    ),
                }),
            ] as Array<AdminColumnDef<AssessmentListItem>>,
        [endpoint, tools],
    );

    return (
        <DataTable
            columns={columns}
            data={assessments}
            pageSize={20}
            emptyMessage="No assessments yet. Add the first item in this offering's grading plan."
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
                    <AssessmentDialog
                        endpoint={endpoint}
                        tools={tools}
                        trigger={
                            <Button disabled={totalWeight >= 100}>
                                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                                New assessment
                            </Button>
                        }
                    />
                </>
            }
        />
    );
}

function AssessmentDialog({
    endpoint,
    tools,
    assessment,
    trigger,
}: {
    endpoint: string;
    tools: ToolOption[];
    assessment?: AssessmentListItem;
    trigger: ReactElement;
}) {
    return (
        <ResourceFormDialog<AssessmentFormValue, AssessmentSchemaValue>
            schema={AssessmentSchema}
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
                        dueAt: toLocalInput(assessment.dueAt),
                        toolIds: assessment.tools.map((tool) => tool.id),
                    } as AssessmentFormValue,
                }
            }
            createEndpoint={endpoint}
            title={{ create: 'New assessment', edit: 'Edit assessment' }}
            description={{
                create: 'Add one item to this offering’s grading plan.',
                edit: 'Update dates, weight, flags and allowed tools.',
            }}
            trigger={trigger}
            fields={(form) => (
                <>
                    <FormInput
                        control={form.control}
                        name="name"
                        label="Name"
                        placeholder="Project report"
                        autoComplete="off"
                    />
                    <FormTextarea
                        control={form.control}
                        name="description"
                        label="Description"
                        description="Optional."
                        placeholder="What students are expected to submit."
                        rows={3}
                    />
                    <FormInput
                        control={form.control}
                        name="weight"
                        label="Weight (%)"
                        description="All assessments in this offering may total at most 100%."
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        inputMode="decimal"
                    />
                    <FormInput
                        control={form.control}
                        name="publishAt"
                        label="Publish at"
                        description="Optional. Leave blank to keep this assessment unpublished."
                        type="datetime-local"
                    />
                    <FormInput
                        control={form.control}
                        name="dueAt"
                        label="Due at"
                        type="datetime-local"
                    />
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
                    <FormCheckboxList
                        control={form.control}
                        name="toolIds"
                        label="Allowed tools"
                        description="No selection means this assessment does not use an embedded tool."
                        emptyMessage="No tools have been registered by the platform yet."
                        options={tools.map((tool) => ({
                            value: tool.id,
                            label: tool.name,
                            description: tool.description ?? tool.code,
                        }))}
                    />
                </>
            )}
        />
    );
}

function AssessmentActions({
    assessment,
    endpoint,
    tools,
}: {
    assessment: AssessmentListItem;
    endpoint: string;
    tools: ToolOption[];
}) {
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
                    <AssessmentDialog
                        endpoint={endpoint}
                        tools={tools}
                        assessment={assessment}
                        trigger={
                            <DropdownMenuItem closeOnClick={false}>
                                <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                                Edit
                            </DropdownMenuItem>
                        }
                    />
                    <DropdownMenuSeparator />
                    <DeleteResourceDialog
                        endpoint={`${endpoint}/${assessment.id}`}
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
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

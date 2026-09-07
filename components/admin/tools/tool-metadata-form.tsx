'use client';

import { useRouter } from 'next/navigation';

import { ResourceFormPage, ResourceFormSection } from '@/components/admin/resource-form-page';
import { FormInput } from '@/components/form';
import {
    EMPTY_TOOL_FORM,
    ToolSchema,
    type ToolFormValue,
    type ToolSchemaValue,
} from '@/lib/admin/tool-schema';

export type ToolMetadata = ToolSchemaValue & { id: string };

export function ToolMetadataForm({ tool }: { tool: ToolMetadata }) {
    const router = useRouter();
    const back = () => router.push(`/admin/tools/${tool.id}`);

    return (
        <ResourceFormPage<ToolFormValue, ToolSchemaValue>
            schema={ToolSchema}
            emptyValues={EMPTY_TOOL_FORM}
            editing={{
                id: tool.id,
                values: {
                    code: tool.code,
                    name: tool.name,
                    description: tool.description ?? '',
                    codeBaseLocation: tool.codeBaseLocation ?? '',
                },
            }}
            createEndpoint="/api/admin/tools"
            title={{ create: 'New tool', edit: 'Edit tool details' }}
            description={{
                create: 'Define a tool and upload its first package.',
                edit: 'Metadata changes do not modify any deployed package.',
            }}
            onCancel={back}
            onSaved={back}
        >
            {(form) => (
                <ResourceFormSection
                    title="Tool identity"
                    description="The code is a permanent URL identifier. Runtime code is managed separately as immutable versions."
                >
                    <div className="grid gap-5 md:grid-cols-2">
                        <FormInput control={form.control} name="name" label="Name" placeholder="Code Workspace" autoComplete="off" />
                        <FormInput control={form.control} name="code" label="Code" description="Permanent and cannot be changed." readOnly className="font-mono" />
                        <FormInput control={form.control} name="description" label="Description" description="Optional." placeholder="What students do with it." autoComplete="off" />
                        <FormInput control={form.control} name="codeBaseLocation" label="Source code" description="Optional repository or project URL." placeholder="https://github.com/…" autoComplete="off" />
                    </div>
                </ResourceFormSection>
            )}
        </ResourceFormPage>
    );
}

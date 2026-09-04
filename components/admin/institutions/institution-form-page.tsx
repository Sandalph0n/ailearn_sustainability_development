'use client';

import {
    ResourceFormPage,
    ResourceFormSection,
} from '@/components/admin/resource-form-page';
import { FormInput } from '@/components/form';
import {
    EMPTY_INSTITUTION_FORM,
    InstitutionSchema,
    type InstitutionFormValue,
    type InstitutionSchemaValue,
} from '@/lib/admin/institution-schema';

export type InstitutionRow = {
    id: string;
    name: string;
    website: string | null;
};

export function InstitutionFormPage({
    institution,
    endpoint = '/api/admin/institutions',
    editEndpoint,
    onCancel,
}: {
    institution?: InstitutionRow;
    endpoint?: string;
    editEndpoint?: string;
    onCancel: () => void;
}) {
    return (
        <ResourceFormPage<InstitutionFormValue, InstitutionSchemaValue>
            schema={InstitutionSchema}
            emptyValues={EMPTY_INSTITUTION_FORM}
            editing={
                institution && {
                    id: institution.id,
                    values: {
                        name: institution.name,
                        website: institution.website ?? '',
                    },
                }
            }
            createEndpoint={endpoint}
            editEndpoint={editEndpoint}
            title={{ create: 'New institution', edit: 'Edit institution' }}
            description={{
                create: 'Add a school or university to the platform.',
                edit: 'Changes apply everywhere this institution appears.',
            }}
            onCancel={onCancel}
        >
            {(form) => (
                <ResourceFormSection
                    title="Institution details"
                    description="Use the official public name and, when available, the institution’s main website."
                >
                    <div className="grid gap-5 md:grid-cols-2">
                        <FormInput
                            control={form.control}
                            name="name"
                            label="Name"
                            placeholder="Macquarie University"
                            autoComplete="off"
                        />
                        <FormInput
                            control={form.control}
                            name="website"
                            label="Website"
                            description="Optional. Include https://"
                            placeholder="https://mq.edu.au"
                            autoComplete="off"
                        />
                    </div>
                </ResourceFormSection>
            )}
        </ResourceFormPage>
    );
}

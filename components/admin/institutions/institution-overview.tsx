'use client';

import { useState, type ReactNode } from 'react';

import {
    InstitutionFormPage,
    type InstitutionRow,
} from '@/components/admin/institutions/institution-form-page';
import { Button } from '@/components/ui/button';

export function InstitutionOverview({
    institution,
    heading,
    children,
}: {
    institution: InstitutionRow;
    heading: ReactNode;
    children: ReactNode;
}) {
    const [editing, setEditing] = useState(false);

    if (editing) {
        return <InstitutionFormPage institution={institution} onCancel={() => setEditing(false)} />;
    }

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-wrap items-start justify-between gap-4">
                {heading}
                <Button variant="outline" onClick={() => setEditing(true)}>
                    Edit details
                </Button>
            </section>
            {children}
        </div>
    );
}

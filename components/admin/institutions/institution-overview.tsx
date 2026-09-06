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
    logo,
    canEdit = true,
    editEndpoint,
    children,
}: {
    institution: InstitutionRow;
    heading: ReactNode;
    /**
     * Ô đổi logo. Truyền vào thay vì dựng ở đây, vì hai lối vào gọi hai endpoint khác nhau —
     * quản trị viên toàn hệ thống và người trong chính cơ sở đó.
     */
    logo?: ReactNode;
    canEdit?: boolean;
    editEndpoint?: string;
    children: ReactNode;
}) {
    const [editing, setEditing] = useState(false);

    if (editing) {
        return (
            <InstitutionFormPage
                institution={institution}
                editEndpoint={editEndpoint}
                onCancel={() => setEditing(false)}
            />
        );
    }

    return (
        <div className="flex flex-col gap-6 pt-1">
            <section className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-wrap items-start gap-5">
                    {logo}
                    {heading}
                </div>
                {canEdit && (
                    <Button variant="outline" onClick={() => setEditing(true)}>
                        Edit details
                    </Button>
                )}
            </section>
            {children}
        </div>
    );
}

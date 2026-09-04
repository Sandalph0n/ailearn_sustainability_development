import { HugeiconsIcon } from '@hugeicons/react';
import { LinkSquare02Icon } from '@hugeicons/core-free-icons';

import { InstitutionOverview } from '@/components/admin/institutions/institution-overview';
import { Badge } from '@/components/ui/badge';
import { requireInstitutionWorkspace } from '@/lib/auth/institution-workspace';
import { hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { contextSearchParams } from '@/lib/context/context-params';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SETTINGS_PERMISSIONS = [
    PERMISSION_CODE.INSTITUTION_SETTINGS_VIEW,
    PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE,
] as const;

export default async function InstitutionSettingsPage({
    searchParams,
}: PageProps<'/navigation/institution/settings'>) {
    const query = await searchParams;
    const active = await requireInstitutionWorkspace(query, SETTINGS_PERMISSIONS);
    const institution = await db.institution.findUniqueOrThrow({
        where: { id: active.institution.id },
        select: { id: true, name: true, website: true },
    });
    const contextQuery = new URLSearchParams(contextSearchParams(active)).toString();

    return (
        <main className="mx-auto w-full max-w-6xl py-7">
            <header className="mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                    Settings
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Maintain the public identity of {institution.name}.
                </p>
            </header>

            <section className="bg-card rounded-xl border p-6 shadow-sm">
                <InstitutionOverview
                    institution={institution}
                    canEdit={hasPermission(
                        active.permissions,
                        PERMISSION_CODE.INSTITUTION_SETTINGS_UPDATE,
                    )}
                    editEndpoint={`/api/institutions/${institution.id}/settings?${contextQuery}`}
                    heading={
                        <div className="space-y-2">
                            <Badge variant="outline">Institution profile</Badge>
                            <h2 className="font-heading text-xl font-semibold">
                                {institution.name}
                            </h2>
                            {institution.website ? (
                                <a
                                    href={institution.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
                                >
                                    {institution.website.replace(/^https?:\/\//, '')}
                                    <HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5" />
                                </a>
                            ) : (
                                <p className="text-muted-foreground text-sm">No website set</p>
                            )}
                        </div>
                    }
                >
                    <p className="text-muted-foreground border-t pt-5 text-sm">
                        Acting as <span className="text-foreground font-medium">{active.role.roleName}</span>.
                    </p>
                </InstitutionOverview>
            </section>
        </main>
    );
}

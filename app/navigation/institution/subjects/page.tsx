import { redirect } from 'next/navigation';

import { SubjectsSection } from '@/components/admin/subjects/subjects-section';
import { findSelectedContext } from '@/lib/auth/authorization-policy';
import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import { hasAnyPermission, hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import {
    CONTEXT_PARAM,
    contextSearchParams,
    type AuthorizedContextOption,
} from '@/lib/context/context-params';

export const dynamic = 'force-dynamic';

const SUBJECT_ACTIONS = [
    PERMISSION_CODE.SUBJECT_CREATE,
    PERMISSION_CODE.SUBJECT_VIEW,
    PERMISSION_CODE.SUBJECT_UPDATE,
    PERMISSION_CODE.SUBJECT_DELETE,
] as const;

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export default async function InstitutionSubjectsPage({
    searchParams,
}: PageProps<'/navigation/institution/subjects'>) {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const query = await searchParams;
    const contexts = await listAuthorizedContextOptions(session.user.id);
    const institutionId = first(query[CONTEXT_PARAM.institution]);
    const roleId = first(query[CONTEXT_PARAM.role]);
    const offeringId = first(query[CONTEXT_PARAM.offering]) ?? null;
    const suppliedContext = Boolean(institutionId || roleId || offeringId);

    let active: AuthorizedContextOption | null = null;
    if (institutionId && roleId) {
        active = findSelectedContext(contexts, { institutionId, roleId, offeringId });
    } else if (!suppliedContext) {
        active = contexts[0] ?? null;
    }

    // Không fallback khi URL đã chỉ đích danh một context sai: đây là boundary đọc dữ liệu.
    if (
        !active ||
        active.role.scopeType !== 'INSTITUTION' ||
        !hasAnyPermission(active.permissions, SUBJECT_ACTIONS)
    ) {
        redirect('/navigation/dashboard');
    }

    const capabilities = {
        create: hasPermission(active.permissions, PERMISSION_CODE.SUBJECT_CREATE),
        view: hasPermission(active.permissions, PERMISSION_CODE.SUBJECT_VIEW),
        update: hasPermission(active.permissions, PERMISSION_CODE.SUBJECT_UPDATE),
        delete: hasPermission(active.permissions, PERMISSION_CODE.SUBJECT_DELETE),
    };
    const contextQuery = new URLSearchParams(contextSearchParams(active)).toString();

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-6 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="font-heading text-2xl font-semibold tracking-tight">
                            Subjects
                        </h1>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                            Maintain the subject catalog for {active.institution.name}. Offerings
                            connect these subjects to individual study terms.
                        </p>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Acting as <span className="text-foreground font-medium">{active.role.roleName}</span>
                    </p>
                </div>
            </header>

            <SubjectsSection
                searchParams={query}
                lockedInstitutionId={active.institution.id}
                endpoint={`/api/institutions/${active.institution.id}/subjects`}
                contextQuery={contextQuery}
                subjectBasePath="/navigation/institution/subjects"
                capabilities={capabilities}
            />
        </main>
    );
}

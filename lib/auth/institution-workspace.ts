import 'server-only';

import { redirect } from 'next/navigation';

import { findSelectedContext } from '@/lib/auth/authorization-policy';
import { listAuthorizedContextOptions } from '@/lib/auth/authorization-service';
import { hasAnyPermission, type PermissionCode } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import {
    CONTEXT_PARAM,
    type AuthorizedContextOption,
} from '@/lib/context/context-params';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

/** Resolve one institution-scoped role for a navigation management page. */
export async function requireInstitutionWorkspace(
    query: SearchParams,
    permissions: readonly PermissionCode[],
): Promise<AuthorizedContextOption> {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const contexts = await listAuthorizedContextOptions(session.user.id);
    const institutionId = first(query[CONTEXT_PARAM.institution]);
    const roleId = first(query[CONTEXT_PARAM.role]);
    const offeringId = first(query[CONTEXT_PARAM.offering]) ?? null;
    const suppliedContext = Boolean(institutionId || roleId || offeringId);

    const active =
        institutionId && roleId
            ? findSelectedContext(contexts, { institutionId, roleId, offeringId })
            : suppliedContext
              ? null
              : (contexts[0] ?? null);

    if (
        !active ||
        active.role.scopeType !== 'INSTITUTION' ||
        !hasAnyPermission(active.permissions, permissions)
    ) {
        redirect('/navigation/dashboard');
    }

    return active;
}

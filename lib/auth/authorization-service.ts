import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';
import {
    authorizedFor,
    effectivePermissionCodes,
    findSelectedContext,
    type ContextSelector,
} from '@/lib/auth/authorization-policy';
import type { PermissionCode } from '@/lib/auth/permissions';
import { listContextOptions } from '@/lib/context/active-context';
import type {
    AuthorizedContextOption,
    ContextOption,
} from '@/lib/context/context-params';
import { db } from '@/lib/db';

type AuthorizationClient = Pick<
    Prisma.TransactionClient,
    'roleInclusion' | 'rolePermission'
>;

/** Add the active permission closure to contexts without changing their ordering. */
export async function attachContextPermissions(
    client: AuthorizationClient,
    contexts: readonly ContextOption[],
): Promise<AuthorizedContextOption[]> {
    const institutionIds = [
        ...new Set(contexts.map((context) => context.institution.id)),
    ];
    if (institutionIds.length === 0) return [];

    const [inclusions, grants] = await Promise.all([
        client.roleInclusion.findMany({
            where: { includingRole: { institutionId: { in: institutionIds } } },
            select: { includingRoleId: true, includedRoleId: true },
        }),
        client.rolePermission.findMany({
            where: {
                revokedAt: null,
                role: { institutionId: { in: institutionIds } },
            },
            select: {
                roleId: true,
                permission: { select: { permission: true } },
            },
        }),
    ]);

    const permissionGrants = grants.map((grant) => ({
        roleId: grant.roleId,
        permission: grant.permission.permission,
    }));

    return contexts.map((context) => ({
        ...context,
        permissions: effectivePermissionCodes(
            context.role.id,
            inclusions,
            permissionGrants,
        ),
    }));
}

export async function listAuthorizedContextOptions(
    userId: string,
): Promise<AuthorizedContextOption[]> {
    const contexts = await listContextOptions(userId);
    return attachContextPermissions(db, contexts);
}

/**
 * Resolve one exact context and permission for an API/page boundary. Invalid or unauthorized
 * selectors return null; unlike display resolution, authorization must never use a fallback.
 */
export async function authorizeContext(
    userId: string,
    selector: ContextSelector,
    permission: PermissionCode,
): Promise<AuthorizedContextOption | null> {
    const contexts = await listAuthorizedContextOptions(userId);
    const selected = findSelectedContext(contexts, selector);

    return selected && authorizedFor(selected.permissions, permission) ? selected : null;
}

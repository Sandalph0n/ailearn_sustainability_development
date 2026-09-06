import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { requireInstitutionWorkspace } from '@/lib/auth/institution-workspace';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { contextSearchParams } from '@/lib/context/context-params';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const KINDS = ['all', 'role', 'scope', 'request', 'code', 'permission'] as const;
type AuditKind = (typeof KINDS)[number];

type AuditEvent = {
    id: string;
    at: Date;
    kind: Exclude<AuditKind, 'all'>;
    action: string;
    subject: string;
    detail: string;
    actor: string;
};

export default async function InstitutionAuditPage({
    searchParams,
}: PageProps<'/navigation/institution/audit'>) {
    const query = await searchParams;
    const active = await requireInstitutionWorkspace(query, [PERMISSION_CODE.AUDIT_VIEW]);
    const requestedKind = Array.isArray(query.kind) ? query.kind[0] : query.kind;
    const kind = KINDS.includes(requestedKind as AuditKind)
        ? (requestedKind as AuditKind)
        : 'all';
    const institutionId = active.institution.id;

    const [assignments, scopes, roleRequests, scopeRequests, codes, permissions] =
        await Promise.all([
            db.roleAssignment.findMany({
                where: { role: { institutionId } },
                orderBy: { roleGrantedAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    roleGrantedAt: true,
                    roleRevokedAt: true,
                    user: { select: { firstName: true, lastName: true, email: true } },
                    role: { select: { roleName: true } },
                    grantDirectlyBy: {
                        select: { firstName: true, lastName: true, email: true },
                    },
                    fromRequest: { select: { id: true } },
                },
            }),
            db.scopeAssignment.findMany({
                where: { roleAssignment: { role: { institutionId } } },
                orderBy: { assignedAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    source: true,
                    assignedAt: true,
                    revokedAt: true,
                    roleAssignment: {
                        select: {
                            user: { select: { firstName: true, lastName: true, email: true } },
                            role: { select: { roleName: true } },
                        },
                    },
                    offering: {
                        select: {
                            subject: { select: { subjectCode: true } },
                            term: { select: { year: true, session: true } },
                        },
                    },
                    assignedDirectlyBy: {
                        select: { firstName: true, lastName: true, email: true },
                    },
                    revokedBy: { select: { firstName: true, lastName: true, email: true } },
                },
            }),
            db.roleRequest.findMany({
                where: { institutionId },
                orderBy: { requestedAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    requestedAt: true,
                    processedAt: true,
                    status: true,
                    user: { select: { firstName: true, lastName: true, email: true } },
                    role: { select: { roleName: true } },
                    processedBy: {
                        select: { firstName: true, lastName: true, email: true },
                    },
                },
            }),
            db.scopeAssignmentRequest.findMany({
                where: { roleAssignment: { role: { institutionId } } },
                orderBy: { requestedAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    requestedAt: true,
                    processedAt: true,
                    status: true,
                    roleAssignment: {
                        select: {
                            user: { select: { firstName: true, lastName: true, email: true } },
                            role: { select: { roleName: true } },
                        },
                    },
                    offering: {
                        select: {
                            subject: { select: { subjectCode: true } },
                            term: { select: { year: true, session: true } },
                        },
                    },
                    processedBy: {
                        select: { firstName: true, lastName: true, email: true },
                    },
                },
            }),
            db.scopeAssignmentCode.findMany({
                where: { offering: { subject: { institutionId } } },
                orderBy: { createdAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    createdAt: true,
                    usedAt: true,
                    revokedAt: true,
                    offering: {
                        select: {
                            subject: { select: { subjectCode: true } },
                            term: { select: { year: true, session: true } },
                        },
                    },
                    createdBy: { select: { firstName: true, lastName: true, email: true } },
                    revokedBy: { select: { firstName: true, lastName: true, email: true } },
                    usedFor: {
                        select: {
                            roleAssignment: {
                                select: {
                                    user: {
                                        select: { firstName: true, lastName: true, email: true },
                                    },
                                },
                            },
                        },
                    },
                },
            }),
            db.rolePermission.findMany({
                where: { role: { institutionId } },
                orderBy: { grantedAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    grantedAt: true,
                    revokedAt: true,
                    role: { select: { roleName: true } },
                    permission: { select: { permission: true } },
                },
            }),
        ]);

    const events: AuditEvent[] = [];
    for (const row of assignments) {
        const person = personLabel(row.user);
        events.push({
            id: `${row.id}:granted`,
            at: row.roleGrantedAt,
            kind: 'role',
            action: 'Role granted',
            subject: person,
            detail: row.role.roleName,
            actor: row.fromRequest ? 'Approved request' : personLabel(row.grantDirectlyBy),
        });
        if (row.roleRevokedAt) {
            events.push({
                id: `${row.id}:revoked`,
                at: row.roleRevokedAt,
                kind: 'role',
                action: 'Role revoked',
                subject: person,
                detail: row.role.roleName,
                actor: 'Institution administrator',
            });
        }
    }
    for (const row of scopes) {
        const target = offeringLabel(row.offering);
        events.push({
            id: `${row.id}:assigned`,
            at: row.assignedAt,
            kind: 'scope',
            action: 'Scope assigned',
            subject: personLabel(row.roleAssignment.user),
            detail: `${row.roleAssignment.role.roleName} · ${target}`,
            actor:
                row.source === 'DIRECT'
                    ? personLabel(row.assignedDirectlyBy)
                    : row.source === 'CODE'
                      ? 'One-time code'
                      : 'Approved request',
        });
        if (row.revokedAt) {
            events.push({
                id: `${row.id}:revoked`,
                at: row.revokedAt,
                kind: 'scope',
                action: 'Scope revoked',
                subject: personLabel(row.roleAssignment.user),
                detail: `${row.roleAssignment.role.roleName} · ${target}`,
                actor: personLabel(row.revokedBy),
            });
        }
    }
    for (const row of roleRequests) {
        events.push({
            id: `${row.id}:requested`,
            at: row.requestedAt,
            kind: 'request',
            action: 'Role requested',
            subject: personLabel(row.user),
            detail: row.role.roleName,
            actor: personLabel(row.user),
        });
        if (row.processedAt) {
            events.push({
                id: `${row.id}:processed`,
                at: row.processedAt,
                kind: 'request',
                action: row.status === 'APPROVED' ? 'Role request approved' : 'Role request rejected',
                subject: personLabel(row.user),
                detail: row.role.roleName,
                actor: personLabel(row.processedBy),
            });
        }
    }
    for (const row of scopeRequests) {
        const detail = `${row.roleAssignment.role.roleName} · ${offeringLabel(row.offering)}`;
        events.push({
            id: `${row.id}:requested`,
            at: row.requestedAt,
            kind: 'request',
            action: 'Subject access requested',
            subject: personLabel(row.roleAssignment.user),
            detail,
            actor: personLabel(row.roleAssignment.user),
        });
        if (row.processedAt) {
            events.push({
                id: `${row.id}:processed`,
                at: row.processedAt,
                kind: 'request',
                action:
                    row.status === 'APPROVED'
                        ? 'Subject access approved'
                        : 'Subject access rejected',
                subject: personLabel(row.roleAssignment.user),
                detail,
                actor: personLabel(row.processedBy),
            });
        }
    }
    for (const row of codes) {
        const detail = offeringLabel(row.offering);
        events.push({
            id: `${row.id}:created`,
            at: row.createdAt,
            kind: 'code',
            action: 'Access code created',
            subject: detail,
            detail: `Code ${shortId(row.id)}`,
            actor: personLabel(row.createdBy),
        });
        if (row.usedAt) {
            events.push({
                id: `${row.id}:used`,
                at: row.usedAt,
                kind: 'code',
                action: 'Access code redeemed',
                subject: personLabel(row.usedFor?.roleAssignment.user),
                detail,
                actor: personLabel(row.usedFor?.roleAssignment.user),
            });
        }
        if (row.revokedAt) {
            events.push({
                id: `${row.id}:revoked`,
                at: row.revokedAt,
                kind: 'code',
                action: 'Access code revoked',
                subject: detail,
                detail: `Code ${shortId(row.id)}`,
                actor: personLabel(row.revokedBy),
            });
        }
    }
    for (const row of permissions) {
        events.push({
            id: `${row.id}:granted`,
            at: row.grantedAt,
            kind: 'permission',
            action: 'Permission granted',
            subject: row.role.roleName,
            detail: row.permission.permission,
            actor: 'Role configuration',
        });
        if (row.revokedAt) {
            events.push({
                id: `${row.id}:revoked`,
                at: row.revokedAt,
                kind: 'permission',
                action: 'Permission revoked',
                subject: row.role.roleName,
                detail: row.permission.permission,
                actor: 'Role configuration',
            });
        }
    }

    const visibleEvents = events
        .filter((event) => kind === 'all' || event.kind === kind)
        .sort((left, right) => right.at.getTime() - left.at.getTime())
        .slice(0, 200);
    const context = contextSearchParams(active);

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-5 border-b pb-5">
                <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Institution workspace
                </p>
                <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                    Audit history
                </h1>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                    Trace role, scope, request and access-code changes at {active.institution.name}.
                </p>
            </header>

            <nav className="mb-4 flex flex-wrap gap-1" aria-label="Audit event type">
                {KINDS.map((option) => (
                    <Link
                        key={option}
                        href={auditHref(context, option)}
                        aria-current={kind === option ? 'page' : undefined}
                        className={cn(
                            buttonVariants({ variant: 'ghost', size: 'sm' }),
                            kind === option && 'bg-muted',
                        )}
                    >
                        {kindLabel(option)}
                    </Link>
                ))}
            </nav>

            <div className="overflow-hidden rounded-xl border bg-background">
                {visibleEvents.length === 0 ? (
                    <p className="text-muted-foreground px-5 py-12 text-center text-sm">
                        No matching history has been recorded.
                    </p>
                ) : (
                    visibleEvents.map((event) => (
                        <article
                            key={event.id}
                            className="grid gap-2 border-b px-5 py-4 last:border-b-0 md:grid-cols-[10rem_minmax(12rem,0.8fr)_minmax(18rem,1.4fr)_minmax(11rem,0.8fr)] md:items-center"
                        >
                            <time className="text-muted-foreground text-xs tabular-nums">
                                {formatDate(event.at)}
                            </time>
                            <div className="flex min-w-0 items-center gap-2">
                                <Badge variant="outline">{kindLabel(event.kind)}</Badge>
                                <span className="truncate text-sm font-medium">{event.action}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{event.subject}</p>
                                <p className="text-muted-foreground truncate text-xs">{event.detail}</p>
                            </div>
                            <p className="text-muted-foreground truncate text-xs md:text-right">
                                {event.actor}
                            </p>
                        </article>
                    ))
                )}
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
                Showing the latest {visibleEvents.length} matching events. Authorization records are
                retained after revocation.
            </p>
        </main>
    );
}

function personLabel(person: { firstName: string; lastName: string; email: string } | null | undefined) {
    return person ? `${person.firstName} ${person.lastName} · ${person.email}` : 'System';
}

function offeringLabel(offering: {
    subject: { subjectCode: string };
    term: { year: number; session: number };
}) {
    return `${offering.subject.subjectCode} · ${offering.term.year} S${offering.term.session}`;
}

function shortId(id: string) {
    return id.slice(0, 8);
}

function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Australia/Sydney',
    }).format(date);
}

function kindLabel(kind: AuditKind) {
    return {
        all: 'All events',
        role: 'Roles',
        scope: 'Scopes',
        request: 'Requests',
        code: 'Codes',
        permission: 'Permissions',
    }[kind];
}

function auditHref(context: Record<string, string>, kind: AuditKind) {
    const params = new URLSearchParams(context);
    if (kind !== 'all') params.set('kind', kind);
    return `/navigation/institution/audit?${params.toString()}`;
}

import Link from 'next/link';
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    CheckListIcon,
    File01Icon,
    Folder01Icon,
    Shield01Icon,
    UniversityIcon,
    UserMultipleIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

import { buttonVariants } from '@/components/ui/button';
import { attachContextPermissions } from '@/lib/auth/authorization-service';
import { hasAnyPermission, hasPermission, PERMISSION_CODE } from '@/lib/auth/permissions';
import { getCurrentSession } from '@/lib/auth/session/service';
import { resolveActiveContext } from '@/lib/context/active-context';
import { contextSearchParams } from '@/lib/context/context-params';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type DashboardItem = {
    label: string;
    value: number | string;
    detail: string;
    href: string;
    icon: IconSvgElement;
};

const INSTITUTION_PERMISSIONS = [
    PERMISSION_CODE.INSTITUTION_SETTINGS_VIEW,
    PERMISSION_CODE.SUBJECT_VIEW,
    PERMISSION_CODE.TERM_VIEW,
    PERMISSION_CODE.OFFERING_VIEW,
    PERMISSION_CODE.ROLE_VIEW,
    PERMISSION_CODE.MEMBER_VIEW,
    PERMISSION_CODE.ROLE_REQUEST_VIEW,
    PERMISSION_CODE.ROLE_REQUEST_REVIEW,
] as const;

export default async function DashboardPage({ searchParams }: PageProps<'/navigation/dashboard'>) {
    const session = await getCurrentSession();
    const userId = session?.user.id;
    const resolved = userId
        ? await resolveActiveContext(userId, await searchParams)
        : { active: null, options: [], corrected: false };

    if (!userId || resolved.active === null) {
        return (
            <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl items-center py-10 sm:py-16">
                <section className="bg-card flex w-full flex-col gap-6 rounded-xl border p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
                    <div className="bg-brand-teal/10 text-brand-teal flex size-11 shrink-0 items-center justify-center rounded-lg">
                        <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-heading text-lg font-semibold">No active role yet</p>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                            Request a role from an institution, then connect an offering when that role needs subject-level access.
                        </p>
                    </div>
                    <Link href="/navigation/roles" className={buttonVariants({ size: 'lg', className: 'self-start sm:self-auto' })}>
                        Manage roles
                    </Link>
                </section>
            </main>
        );
    }

    const [active] = await attachContextPermissions(db, [resolved.active]);
    const contextQuery = new URLSearchParams(contextSearchParams(active)).toString();
    const href = (path: string) => `${path}?${contextQuery}`;
    const offeringWhere = active.role.scopeType === 'INSTITUTION'
        ? { subject: { institutionId: active.institution.id } }
        : { scopeAssignments: { some: { roleAssignmentId: active.assignmentId, revokedAt: null } } };
    const now = new Date();

    const [offeringCount, publishedAssessmentCount, ownAttemptCount, personalWorkspaceCount, pendingRoleRequests, pendingScopeRequests] = await Promise.all([
        db.offering.count({ where: offeringWhere }),
        db.assessment.count({ where: { offering: offeringWhere, publishAt: { lte: now } } }),
        db.assessmentAttempt.count({ where: { userId, assessment: { offering: offeringWhere } } }),
        db.personalWorkspace.count({ where: { userId } }),
        db.roleRequest.count({ where: { userId, status: 'PENDING' } }),
        db.scopeAssignmentRequest.count({ where: { roleAssignment: { userId }, status: 'PENDING' } }),
    ]);

    const learningItems: DashboardItem[] = [];
    if (hasPermission(active.permissions, PERMISSION_CODE.OFFERING_VIEW)) {
        learningItems.push({ label: 'Subjects', value: offeringCount, detail: active.role.scopeType === 'INSTITUTION' ? 'Offerings visible institution-wide' : 'Offerings connected to this role', href: href('/navigation/subjects'), icon: BookOpen01Icon });
    }
    if (hasAnyPermission(active.permissions, [PERMISSION_CODE.ASSESSMENT_VIEW_PUBLISHED, PERMISSION_CODE.ASSESSMENT_VIEW, PERMISSION_CODE.ASSESSMENT_ATTEMPT])) {
        learningItems.push({ label: 'Published assessments', value: publishedAssessmentCount, detail: 'Available across the current access scope', href: href('/navigation/subjects'), icon: CheckListIcon });
    }
    if (hasAnyPermission(active.permissions, [PERMISSION_CODE.ASSESSMENT_ATTEMPT, PERMISSION_CODE.ATTEMPT_VIEW_OWN])) {
        learningItems.push({ label: 'Your attempts', value: ownAttemptCount, detail: 'In progress and submitted work', href: href('/navigation/workspaces'), icon: File01Icon });
    }

    const institutionItems: DashboardItem[] = [];
    if (active.role.scopeType === 'INSTITUTION' && hasAnyPermission(active.permissions, INSTITUTION_PERMISSIONS)) {
        const [subjects, terms, offerings, people, openRequests] = await Promise.all([
            db.subject.count({ where: { institutionId: active.institution.id } }),
            db.studyTerm.count({ where: { institutionId: active.institution.id } }),
            db.offering.count({ where: { subject: { institutionId: active.institution.id } } }),
            db.roleAssignment.count({ where: { role: { institutionId: active.institution.id }, roleRevokedAt: null } }),
            db.roleRequest.count({ where: { institutionId: active.institution.id, status: 'PENDING' } }),
        ]);
        if (hasPermission(active.permissions, PERMISSION_CODE.SUBJECT_VIEW)) institutionItems.push({ label: 'Subjects', value: subjects, detail: 'Institution catalog', href: href('/navigation/institution/subjects'), icon: UniversityIcon });
        if (hasPermission(active.permissions, PERMISSION_CODE.TERM_VIEW)) institutionItems.push({ label: 'Terms', value: terms, detail: 'Academic periods', href: href('/navigation/institution/terms'), icon: CheckListIcon });
        if (hasPermission(active.permissions, PERMISSION_CODE.OFFERING_VIEW)) institutionItems.push({ label: 'Offerings', value: offerings, detail: 'Scheduled subject deliveries', href: href('/navigation/institution/offerings'), icon: BookOpen01Icon });
        if (hasPermission(active.permissions, PERMISSION_CODE.MEMBER_VIEW)) institutionItems.push({ label: 'Role assignments', value: people, detail: 'Active access records', href: href('/navigation/institution/people'), icon: UserMultipleIcon });
        if (hasPermission(active.permissions, PERMISSION_CODE.ROLE_REQUEST_REVIEW)) institutionItems.push({ label: 'Requests waiting', value: openRequests, detail: 'Role requests requiring review', href: href('/navigation/institution/requests'), icon: Shield01Icon });
    }

    const accessItems: DashboardItem[] = [
        { label: 'Pending role requests', value: pendingRoleRequests, detail: 'Requests awaiting an institution decision', href: href('/navigation/roles'), icon: Shield01Icon },
        { label: 'Pending subject access', value: pendingScopeRequests, detail: 'Offering scopes awaiting review', href: href('/navigation/subject-access'), icon: BookOpen01Icon },
        { label: 'Personal workspaces', value: personalWorkspaceCount, detail: 'Private work with no activity recording', href: href('/navigation/workspaces'), icon: Folder01Icon },
    ];

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
                <div>
                    <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">{active.institution.name}</p>
                    <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">{active.role.roleName} workspace</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Only sections available to this role are shown.</p>
                </div>
                {active.role.scopeType === 'OFFERING' && active.offering === null && <Link href={href('/navigation/subject-access')} className={buttonVariants()}>Connect subject access</Link>}
            </header>
            <div className="space-y-9">
                {learningItems.length > 0 && <DashboardSection title="Learning" description="Subjects, assessments and work in your current scope." items={learningItems} />}
                {institutionItems.length > 0 && <DashboardSection title="Institution" description="Operational areas this role is allowed to manage." items={institutionItems} />}
                <DashboardSection title="Access and personal work" description="Your requests and private workspace activity." items={accessItems} />
            </div>
        </main>
    );
}

function DashboardSection({ title, description, items }: { title: string; description: string; items: DashboardItem[] }) {
    return (
        <section>
            <div className="mb-3"><h2 className="font-heading text-lg font-semibold">{title}</h2><p className="text-muted-foreground mt-1 text-sm">{description}</p></div>
            <div className="overflow-hidden rounded-xl border">
                {items.map((item) => (
                    <Link key={`${item.label}-${item.href}`} href={item.href} className="bg-card hover:bg-muted/35 group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b px-4 py-4 transition-colors last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_auto]">
                        <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg"><HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-5" /></div>
                        <div className="min-w-0"><p className="font-medium">{item.label}</p><p className="text-muted-foreground mt-0.5 truncate text-xs">{item.detail}</p></div>
                        <p className="font-heading text-right text-xl font-semibold tabular-nums">{item.value}</p>
                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                ))}
            </div>
        </section>
    );
}

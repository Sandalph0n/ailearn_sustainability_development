import { redirect } from 'next/navigation';

import {
    SubjectAccess,
    type SubjectAccessOffering,
    type SubjectAccessRole,
} from '@/components/navigation/subject-access';
import { getCurrentSession } from '@/lib/auth/session/service';
import { CONTEXT_PARAM } from '@/lib/context/context-params';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function SubjectAccessPage({
    searchParams,
}: PageProps<'/navigation/subject-access'>) {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const query = await searchParams;
    const first = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value[0] : value;
    const selectedInstitutionId = first(query[CONTEXT_PARAM.institution]);
    const selectedRoleId = first(query[CONTEXT_PARAM.role]);

    const assignments = await db.roleAssignment.findMany({
        where: {
            userId: session.user.id,
            roleRevokedAt: null,
        },
        orderBy: [{ role: { institution: { name: 'asc' } } }, { role: { roleName: 'asc' } }],
        select: {
            id: true,
            role: {
                select: {
                    id: true,
                    scopeType: true,
                    roleName: true,
                    institution: { select: { id: true, name: true } },
                },
            },
            scopeAssignments: {
                where: { revokedAt: null },
                select: {
                    id: true,
                    source: true,
                    offering: {
                        select: {
                            id: true,
                            subject: {
                                select: {
                                    institutionId: true,
                                    subjectCode: true,
                                    subjectName: true,
                                },
                            },
                            term: { select: { year: true, session: true } },
                        },
                    },
                },
            },
            scopeRequests: {
                where: { status: 'PENDING' },
                select: {
                    id: true,
                    offering: {
                        select: {
                            id: true,
                            subject: {
                                select: {
                                    institutionId: true,
                                    subjectCode: true,
                                    subjectName: true,
                                },
                            },
                            term: { select: { year: true, session: true } },
                        },
                    },
                },
            },
        },
    });

    const institutionIds = [...new Set(assignments.map((row) => row.role.institution.id))];
    const offeringRows =
        institutionIds.length === 0
            ? []
            : await db.offering.findMany({
                  where: { subject: { institutionId: { in: institutionIds } } },
                  orderBy: [
                      { term: { year: 'desc' } },
                      { term: { session: 'asc' } },
                      { subject: { subjectCode: 'asc' } },
                  ],
                  select: {
                      id: true,
                      subject: {
                          select: {
                              institutionId: true,
                              subjectCode: true,
                              subjectName: true,
                          },
                      },
                      term: { select: { year: true, session: true } },
                  },
              });

    function toOffering(row: (typeof offeringRows)[number]): SubjectAccessOffering {
        return {
            id: row.id,
            institutionId: row.subject.institutionId,
            subjectCode: row.subject.subjectCode,
            subjectName: row.subject.subjectName,
            year: row.term.year,
            session: row.term.session,
        };
    }

    const roles: SubjectAccessRole[] = assignments.map((assignment) => ({
        assignmentId: assignment.id,
        scopeType: assignment.role.scopeType,
        roleName: assignment.role.roleName,
        institution: assignment.role.institution,
        scopes: assignment.scopeAssignments.map((scope) => ({
            id: scope.id,
            source: scope.source,
            offering: toOffering(scope.offering),
        })),
        pendingRequests: assignment.scopeRequests.map((request) => ({
            id: request.id,
            offering: toOffering(request.offering),
        })),
    }));

    const selectedAssignment = assignments.find(
        (assignment) =>
            assignment.role.id === selectedRoleId &&
            assignment.role.institution.id === selectedInstitutionId,
    );

    return (
        <SubjectAccess
            roles={roles}
            offerings={offeringRows.map(toOffering)}
            initialAssignmentId={selectedAssignment?.id ?? roles.at(0)?.assignmentId ?? null}
        />
    );
}

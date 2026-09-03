import { redirect } from 'next/navigation';

import {
    SubjectAccess,
    type SubjectAccessOffering,
    type SubjectAccessRole,
} from '@/components/navigation/subject-access';
import { getCurrentSession } from '@/lib/auth/session/service';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function SubjectAccessPage() {
    const session = await getCurrentSession();
    if (!session) redirect('/api/auth/clear-invalid-session');

    const assignments = await db.roleAssignment.findMany({
        where: {
            userId: session.user.id,
            roleRevokedAt: null,
            role: { scopeType: 'OFFERING' },
        },
        orderBy: [{ role: { institution: { name: 'asc' } } }, { role: { roleName: 'asc' } }],
        select: {
            id: true,
            role: {
                select: {
                    roleName: true,
                    institution: { select: { id: true, name: true } },
                },
            },
            scopeAssignments: {
                select: {
                    id: true,
                    isAssignedUsingCode: true,
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
        roleName: assignment.role.roleName,
        institution: assignment.role.institution,
        scopes: assignment.scopeAssignments.map((scope) => ({
            id: scope.id,
            source: scope.isAssignedUsingCode ? 'CODE' : 'DIRECT',
            offering: toOffering(scope.offering),
        })),
        pendingRequests: assignment.scopeRequests.map((request) => ({
            id: request.id,
            offering: toOffering(request.offering),
        })),
    }));

    return <SubjectAccess roles={roles} offerings={offeringRows.map(toOffering)} />;
}

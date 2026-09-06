import {
    ScopeCodesTable,
    type ScopeCodeListItem,
} from '@/components/admin/scope-codes/scope-codes-table';
import { db } from '@/lib/db';

export type ScopeCodeCapabilities = {
    view: boolean;
    create: boolean;
    revoke: boolean;
};

export async function ScopeCodesSection({
    institutionId,
    endpoint,
    contextQuery,
    capabilities,
}: {
    institutionId: string;
    endpoint: string;
    contextQuery: string;
    capabilities: ScopeCodeCapabilities;
}) {
    const [rows, offerings] = await Promise.all([
        capabilities.view
            ? db.scopeAssignmentCode.findMany({
                  where: { offering: { subject: { institutionId } } },
                  orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
                  select: {
                      id: true,
                      createdAt: true,
                      usedAt: true,
                      revokedAt: true,
                      offering: {
                          select: {
                              id: true,
                              subject: {
                                  select: { subjectCode: true, subjectName: true },
                              },
                              term: { select: { year: true, session: true } },
                          },
                      },
                      createdBy: {
                          select: { firstName: true, lastName: true, email: true },
                      },
                      usedFor: {
                          select: {
                              roleAssignment: {
                                  select: {
                                      user: {
                                          select: {
                                              firstName: true,
                                              lastName: true,
                                              email: true,
                                          },
                                      },
                                      role: { select: { roleName: true } },
                                  },
                              },
                          },
                      },
                  },
              })
            : Promise.resolve([]),
        capabilities.create
            ? db.offering.findMany({
                  where: { subject: { institutionId } },
                  orderBy: [
                      { term: { year: 'desc' } },
                      { term: { session: 'asc' } },
                      { subject: { subjectCode: 'asc' } },
                  ],
                  select: {
                      id: true,
                      subject: { select: { subjectCode: true, subjectName: true } },
                      term: { select: { year: true, session: true } },
                  },
              })
            : Promise.resolve([]),
    ]);

    const date = new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Australia/Sydney',
    });
    const codes: ScopeCodeListItem[] = rows.map((row) => ({
        id: row.id,
        created: date.format(row.createdAt),
        used: row.usedAt ? date.format(row.usedAt) : null,
        revoked: row.revokedAt ? date.format(row.revokedAt) : null,
        offering: row.offering,
        createdBy: row.createdBy,
        usedBy: row.usedFor?.roleAssignment.user ?? null,
        usedByRole: row.usedFor?.roleAssignment.role.roleName ?? null,
    }));

    return (
        <ScopeCodesTable
            codes={codes}
            offerings={offerings}
            endpoint={endpoint}
            contextQuery={contextQuery}
            capabilities={capabilities}
        />
    );
}

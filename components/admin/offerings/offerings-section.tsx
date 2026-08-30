import { OfferingsTable, type OfferingListItem } from '@/components/admin/offerings/offerings-table';
import {
    PAGE_SIZE,
    pageCountOf,
    parseListParams,
    parseOptionalUuid,
} from '@/lib/admin/list-params';
import { db } from '@/lib/db';

export async function OfferingsSection({
    institutionId,
    searchParams,
}: {
    institutionId: string;
    searchParams: Record<string, string | string[] | undefined>;
}) {
    const SORT_FIELDS = ['subject', 'term', 'assessments'] as const;
    const { q, page, sort, dir, skip } = parseListParams(searchParams, SORT_FIELDS);
    const subjectId = parseOptionalUuid(searchParams.subject);
    const termId = parseOptionalUuid(searchParams.term);
    const year = /^\d{4}$/.test(q) ? Number(q) : null;

    const where = {
        subject: { institutionId },
        ...(subjectId ? { subjectId } : {}),
        ...(termId ? { termId } : {}),
        ...(q
            ? {
                  OR: [
                      { subject: { subjectCode: { contains: q, mode: 'insensitive' as const } } },
                      { subject: { subjectName: { contains: q, mode: 'insensitive' as const } } },
                      ...(year === null ? [] : [{ term: { year } }]),
                  ],
              }
            : {}),
    };

    const orderBy =
        sort === 'term'
            ? { term: { year: dir } }
            : sort === 'assessments'
              ? { assessments: { _count: dir } }
              : { subject: { subjectCode: dir } };

    const [rows, total, subjects, terms] = await Promise.all([
        db.offering.findMany({
            where,
            orderBy: [orderBy, { id: 'asc' }],
            take: PAGE_SIZE,
            skip,
            select: {
                id: true,
                subject: { select: { id: true, subjectCode: true, subjectName: true } },
                term: { select: { id: true, year: true, session: true } },
                _count: {
                    select: {
                        assessments: true,
                        roleAssignments: { where: { roleRevokedAt: null } },
                    },
                },
            },
        }),
        db.offering.count({ where }),
        db.subject.findMany({
            where: { institutionId },
            orderBy: [{ subjectCode: 'asc' }, { id: 'asc' }],
            select: { id: true, subjectCode: true, subjectName: true },
        }),
        db.studyTerm.findMany({
            where: { institutionId },
            orderBy: [{ year: 'desc' }, { session: 'asc' }, { id: 'asc' }],
            select: { id: true, year: true, session: true },
        }),
    ]);

    const offerings: OfferingListItem[] = rows.map((row) => ({
        id: row.id,
        subject: row.subject,
        term: row.term,
        counts: {
            assessments: row._count.assessments,
            assignments: row._count.roleAssignments,
        },
    }));

    return (
        <OfferingsTable
            offerings={offerings}
            institutionId={institutionId}
            subjects={subjects}
            terms={terms}
            subjectId={subjectId}
            termId={termId}
            page={page}
            pageCount={pageCountOf(total)}
            total={total}
            sort={sort}
            dir={dir}
        />
    );
}

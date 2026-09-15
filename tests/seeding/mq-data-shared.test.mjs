import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { deterministicUuid, parseExactDue } from '../../scripts/seeding/mq-data-shared.mjs';

describe('Macquarie seed data helpers', () => {
    it('accepts only valid dd/mm/yyyy dates and places them at 23:59 Sydney time', () => {
        expect(parseExactDue('Submit by 07/09/2026')).toBe(
            '2026-09-07 23:59:00 Australia/Sydney',
        );
        expect(parseExactDue('Submit by 7/9/2026')).toBeNull();
        expect(parseExactDue('Submit by 31/02/2026')).toBeNull();
        expect(parseExactDue('Week 7')).toBeNull();
    });

    it('uses the final valid date when the source publishes a date range', () => {
        expect(parseExactDue('Available 01/05/2026 through 05/05/2026')).toBe(
            '2026-05-05 23:59:00 Australia/Sydney',
        );
    });

    it('generates stable, valid UUID-shaped identifiers', () => {
        const first = deterministicUuid('subject:COMP1000');
        expect(first).toBe(deterministicUuid('subject:COMP1000'));
        expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
});

describe('Macquarie assessment publication seed', () => {
    const publicationCsv = readFileSync(
        new URL(
            '../../prisma/seedingdata/source/mq-2026/assessment-publications.csv',
            import.meta.url,
        ),
        'utf8',
    );
    const assessmentSql = readFileSync(
        new URL('../../prisma/seedingdata/050-mq-assessments.sql', import.meta.url),
        'utf8',
    );

    it('publishes the selected COMP and LAWS subjects without publishing the whole catalog', () => {
        const publishedSubjects = publicationCsv
            .trim()
            .split(/\r?\n/)
            .slice(1)
            .map((line) => line.split(',')[0]);

        expect(publishedSubjects).toEqual([
            'COMP1000',
            'COMP1010',
            'COMP1050',
            'COMP1300',
            'COMP1350',
            'COMP2100',
            'COMP2200',
            'COMP2300',
            'LAWS5018',
            'LAWS8021',
        ]);
        expect(assessmentSql).toContain(
            "'COMP1000', 2026, 1, 'Project Handover and Review'",
        );
        expect(assessmentSql).toContain(
            "TIMESTAMPTZ '2026-01-01 00:00:00 Australia/Sydney'",
        );

        const assessmentRows = assessmentSql
            .split(/\r?\n/)
            .filter((line) => /^\s*\('[0-9a-f-]{36}'/.test(line));
        const configuredRows = assessmentRows.filter((line) =>
            publishedSubjects.some((subjectCode) => line.includes(`'${subjectCode}'`)),
        );
        const unconfiguredRow = assessmentRows.find((line) => line.includes("'COMP1151'"));

        expect(configuredRows.length).toBeGreaterThan(0);
        expect(
            configuredRows.every((line) =>
                line.includes("TIMESTAMPTZ '2026-01-01 00:00:00 Australia/Sydney'"),
            ),
        ).toBe(true);
        expect(unconfiguredRow).toContain('FALSE, FALSE, NULL,');
    });
});

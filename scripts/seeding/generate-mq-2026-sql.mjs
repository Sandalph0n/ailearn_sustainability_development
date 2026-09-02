/** Stage 2: turn the reviewed Macquarie CSV files into ordered PostgreSQL seed files. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    MQ_INSTITUTION_NAME,
    parseExactDue,
    readCsv,
    sqlBoolean,
    sqlString,
    sqlTimestamp,
} from './mq-data-shared.mjs';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const seedDirectory = path.join(projectRoot, 'prisma', 'seedingdata');
const sourceDirectory = path.join(seedDirectory, 'source', 'mq-2026');

function values(rows, columns) {
    return rows
        .map((row) => `    (${columns.map((column) => column(row)).join(', ')})`)
        .join(',\n');
}

function header(entity, sourceFile) {
    return `-- Generated from ${sourceFile} by scripts/seeding/generate-mq-2026-sql.mjs.\n-- Review the CSV source and regenerate; do not hand-edit this file.\n\n`;
}

function assertUnique(rows, key, label) {
    const seen = new Set();
    for (const row of rows) {
        const value = key(row);
        if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
        seen.add(value);
    }
}

function validateData(institutions, terms, subjects, offerings, assessments) {
    if (institutions.length !== 1 || institutions[0].name !== MQ_INSTITUTION_NAME) {
        throw new Error('Expected exactly one Macquarie University row in institutions.csv');
    }
    if (terms.length !== 2 || terms.some((term) => !['1', '2'].includes(term.session))) {
        throw new Error('Expected exactly Session 1 and Session 2 in terms.csv');
    }
    if (subjects.length === 0 || offerings.length === 0 || assessments.length === 0) {
        throw new Error('Subject, offering and assessment CSV files must not be empty');
    }

    assertUnique(institutions, (row) => row.id, 'institution id');
    assertUnique(terms, (row) => row.id, 'term id');
    assertUnique(subjects, (row) => row.id, 'subject id');
    assertUnique(subjects, (row) => row.subject_code, 'subject code');
    assertUnique(offerings, (row) => row.id, 'offering id');
    assertUnique(
        offerings,
        (row) => `${row.subject_code}:${row.year}:${row.session}`,
        'subject/session offering',
    );
    assertUnique(assessments, (row) => row.id, 'assessment id');
    assertUnique(
        assessments,
        (row) => `${row.subject_code}:${row.year}:${row.session}:${row.name}`,
        'assessment name within offering',
    );

    const subjectCodes = new Set(subjects.map((row) => row.subject_code));
    const offeringKeys = new Set(
        offerings.map((row) => `${row.subject_code}:${row.year}:${row.session}`),
    );
    const weightByOffering = new Map();

    for (const offering of offerings) {
        if (!subjectCodes.has(offering.subject_code)) {
            throw new Error(`Offering references missing subject ${offering.subject_code}`);
        }
        if (!['1', '2'].includes(offering.session)) {
            throw new Error(`Unsupported session in offering ${offering.id}`);
        }
    }

    for (const assessment of assessments) {
        const offeringKey = `${assessment.subject_code}:${assessment.year}:${assessment.session}`;
        if (!offeringKeys.has(offeringKey)) {
            throw new Error(`Assessment references missing offering ${offeringKey}`);
        }

        const weight = Number(assessment.weight);
        if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
            throw new Error(`Invalid weight for assessment ${assessment.id}: ${assessment.weight}`);
        }
        weightByOffering.set(offeringKey, (weightByOffering.get(offeringKey) ?? 0) + weight);

        const expectedDueAt = parseExactDue(assessment.expected_due) ?? '';
        if (assessment.due_at !== expectedDueAt) {
            throw new Error(`Exact due date does not match expectedDue for assessment ${assessment.id}`);
        }
    }

    for (const offeringKey of offeringKeys) {
        const total = weightByOffering.get(offeringKey);
        if (total === undefined) throw new Error(`Offering has no assessments: ${offeringKey}`);
        if (Math.abs(total - 100) > Number.EPSILON) {
            throw new Error(`Assessment weights total ${total}, not 100: ${offeringKey}`);
        }
    }
}

async function main() {
    await mkdir(seedDirectory, { recursive: true });

    const [institutions, terms, subjects, offerings, assessments] = await Promise.all([
        readCsv(path.join(sourceDirectory, 'institutions.csv')),
        readCsv(path.join(sourceDirectory, 'terms.csv')),
        readCsv(path.join(sourceDirectory, 'subjects.csv')),
        readCsv(path.join(sourceDirectory, 'offerings.csv')),
        readCsv(path.join(sourceDirectory, 'assessments.csv')),
    ]);

    validateData(institutions, terms, subjects, offerings, assessments);
    console.log('CSV validation complete.');

    const institutionSql = `${header('institutions', 'source/mq-2026/institutions.csv')}INSERT INTO "Institution" ("id", "name", "website")
VALUES ${values(institutions, [
        (row) => `${sqlString(row.id)}::uuid`,
        (row) => sqlString(row.name),
        (row) => sqlString(row.website),
    ])}
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name", "website" = EXCLUDED."website";
`;

    const termSql = `${header('terms', 'source/mq-2026/terms.csv')}INSERT INTO "StudyTerm" ("id", "institutionId", "year", "session")
SELECT seed."id"::uuid, institution."id", seed."year", seed."session"
FROM (VALUES
${values(terms, [
        (row) => sqlString(row.id),
        (row) => String(Number(row.year)),
        (row) => String(Number(row.session)),
    ])}
) AS seed("id", "year", "session")
CROSS JOIN "Institution" AS institution
WHERE institution."name" = ${sqlString(MQ_INSTITUTION_NAME)}
ON CONFLICT ("institutionId", "year", "session") DO NOTHING;
`;

    const subjectSql = `${header('subjects', 'source/mq-2026/subjects.csv')}INSERT INTO "Subject" ("id", "institutionId", "subjectCode", "subjectName", "subjectDescription")
SELECT
    seed."id"::uuid,
    institution."id",
    seed."subjectCode",
    seed."subjectName",
    seed."subjectDescription"
FROM (VALUES
${values(subjects, [
        (row) => sqlString(row.id),
        (row) => sqlString(row.subject_code),
        (row) => sqlString(row.subject_name),
        (row) => sqlString(row.subject_description),
    ])}
) AS seed("id", "subjectCode", "subjectName", "subjectDescription")
CROSS JOIN "Institution" AS institution
WHERE institution."name" = ${sqlString(MQ_INSTITUTION_NAME)}
ON CONFLICT ("institutionId", "subjectCode") DO UPDATE
SET
    "subjectName" = EXCLUDED."subjectName",
    "subjectDescription" = EXCLUDED."subjectDescription";
`;

    const offeringSql = `${header('offerings', 'source/mq-2026/offerings.csv')}INSERT INTO "Offering" ("id", "subjectId", "termId")
SELECT seed."id"::uuid, subject."id", term."id"
FROM (VALUES
${values(offerings, [
        (row) => sqlString(row.id),
        (row) => sqlString(row.subject_code),
        (row) => String(Number(row.year)),
        (row) => String(Number(row.session)),
    ])}
) AS seed("id", "subjectCode", "year", "session")
JOIN "Institution" AS institution
    ON institution."name" = ${sqlString(MQ_INSTITUTION_NAME)}
JOIN "Subject" AS subject
    ON subject."institutionId" = institution."id"
    AND subject."subjectCode" = seed."subjectCode"
JOIN "StudyTerm" AS term
    ON term."institutionId" = institution."id"
    AND term."year" = seed."year"
    AND term."session" = seed."session"
ON CONFLICT ("subjectId", "termId") DO NOTHING;
`;

    const assessmentSql = `${header('assessments', 'source/mq-2026/assessments.csv')}INSERT INTO "Assessment" (
    "id",
    "offeringId",
    "name",
    "description",
    "weight",
    "hurdle",
    "isGroup",
    "publishAt",
    "dueAt",
    "expectedDue"
)
SELECT
    seed."id"::uuid,
    offering."id",
    seed."name",
    seed."description",
    seed."weight",
    seed."hurdle",
    seed."isGroup",
    NULL,
    seed."dueAt",
    seed."expectedDue"
FROM (VALUES
${values(assessments, [
        (row) => sqlString(row.id),
        (row) => sqlString(row.subject_code),
        (row) => String(Number(row.year)),
        (row) => String(Number(row.session)),
        (row) => sqlString(row.name),
        (row) => sqlString(row.description),
        (row) => String(Number(row.weight)),
        (row) => sqlBoolean(row.hurdle),
        (row) => sqlBoolean(row.is_group),
        (row) => sqlTimestamp(row.due_at),
        (row) => sqlString(row.expected_due),
    ])}
) AS seed(
    "id",
    "subjectCode",
    "year",
    "session",
    "name",
    "description",
    "weight",
    "hurdle",
    "isGroup",
    "dueAt",
    "expectedDue"
)
JOIN "Institution" AS institution
    ON institution."name" = ${sqlString(MQ_INSTITUTION_NAME)}
JOIN "Subject" AS subject
    ON subject."institutionId" = institution."id"
    AND subject."subjectCode" = seed."subjectCode"
JOIN "StudyTerm" AS term
    ON term."institutionId" = institution."id"
    AND term."year" = seed."year"
    AND term."session" = seed."session"
JOIN "Offering" AS offering
    ON offering."subjectId" = subject."id"
    AND offering."termId" = term."id"
ON CONFLICT ("id") DO UPDATE
SET
    "offeringId" = EXCLUDED."offeringId",
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "weight" = EXCLUDED."weight",
    "hurdle" = EXCLUDED."hurdle",
    "isGroup" = EXCLUDED."isGroup",
    "publishAt" = EXCLUDED."publishAt",
    "dueAt" = EXCLUDED."dueAt",
    "expectedDue" = EXCLUDED."expectedDue";
`;

    await Promise.all([
        writeFile(path.join(seedDirectory, '010-mq-institution.sql'), institutionSql, 'utf8'),
        writeFile(path.join(seedDirectory, '020-mq-terms.sql'), termSql, 'utf8'),
        writeFile(path.join(seedDirectory, '030-mq-subjects.sql'), subjectSql, 'utf8'),
        writeFile(path.join(seedDirectory, '040-mq-offerings.sql'), offeringSql, 'utf8'),
        writeFile(path.join(seedDirectory, '050-mq-assessments.sql'), assessmentSql, 'utf8'),
    ]);

    console.log('SQL stage complete:', {
        institutions: institutions.length,
        terms: terms.length,
        subjects: subjects.length,
        offerings: offerings.length,
        assessments: assessments.length,
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

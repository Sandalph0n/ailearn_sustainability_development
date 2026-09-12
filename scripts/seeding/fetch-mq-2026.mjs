/**
 * Stage 1: download public Macquarie Handbook + Unit Guide data and normalise it to CSV.
 *
 * Cached HTML is intentionally ignored by Git. Pass `--refresh` to bypass it.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'cheerio';

import {
    deterministicUuid,
    MQ_INSTITUTION_NAME,
    MQ_INSTITUTION_WEBSITE,
    MQ_YEAR,
    normaliseText,
    parseExactDue,
    writeCsv,
} from './mq-data-shared.mjs';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputDirectory = path.join(projectRoot, 'prisma', 'seedingdata', 'source', 'mq-2026');
const cacheDirectory = path.join(outputDirectory, 'cache');
const refresh = process.argv.includes('--refresh');

const HANDBOOK_ORIGIN = 'https://coursehandbook.mq.edu.au';
const UNIT_GUIDE_ORIGIN = 'https://unitguides.mq.edu.au';

const SOURCES = [
    {
        department: 'School of Computing',
        include: (code) => /^COMP\d{4}$/.test(code),
    },
    {
        department: 'School of Mathematical and Physical Sciences',
        include: (code) =>
            new Set(['MATH1007', 'MATH1010', 'STAT1170', 'STAT1371']).has(code),
    },
    {
        department: 'School of Engineering',
        include: (code) => new Set(['CIVL1001', 'CIVL8204']).has(code),
    },
    {
        department: 'School of Natural Sciences',
        include: (code) => new Set(['BIOL1400', 'BIOL2400']).has(code),
    },
];

const REQUEST_HEADERS = {
    'user-agent': 'Lernumi curriculum seed importer/1.0',
    accept: 'text/html,application/xhtml+xml',
};

function cachePathFor(url) {
    const parsed = new URL(url);
    const key = `${parsed.hostname}${parsed.pathname}${parsed.search}`;
    return path.join(cacheDirectory, `${deterministicUuid(key)}.html`);
}

async function fetchHtml(url) {
    const cachePath = cachePathFor(url);

    if (!refresh) {
        try {
            return await readFile(cachePath, 'utf8');
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const response = await fetch(url, { headers: REQUEST_HEADERS });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const html = await response.text();
            await writeFile(cachePath, html, 'utf8');
            return html;
        } catch (error) {
            lastError = error;
            if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        }
    }

    throw new Error(`Unable to download ${url}`, { cause: lastError });
}

async function mapWithConcurrency(values, concurrency, mapper) {
    const results = new Array(values.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < values.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await mapper(values[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
    return results;
}

function parseListing(html, department) {
    const $ = load(html);
    const rows = [];

    $('a.unit-guide-list-item').each((_, element) => {
        const href = $(element).attr('href') ?? '';
        const id = href.match(/^\/unit_offerings\/(\d+)\/unit_guide$/)?.[1];
        const label = normaliseText($(element).find('.unit-code-and-name').text());
        const match = label.match(/^([A-Z]{4}\d{4})\s+(.+)$/);
        const offeringLabel = normaliseText($(element).find('.unit-handbook-code').text());
        const session = Number(offeringLabel.match(/^Session ([12]),/)?.[1]);

        if (!id || !match || !session) return;

        rows.push({
            sourceOfferingId: id,
            subjectCode: match[1],
            listingName: match[2],
            session,
            offeringLabel,
            department,
            sourceUrl: new URL(href, UNIT_GUIDE_ORIGIN).toString(),
        });
    });

    const total = Number(normaliseText($('.results-count-top').first().text()).match(/of (\d+) in total/)?.[1]);
    return { rows, total: Number.isFinite(total) ? total : rows.length };
}

async function fetchDepartment(source) {
    const encodedDepartment = encodeURIComponent(source.department);
    const firstUrl = `${UNIT_GUIDE_ORIGIN}/units/show_year/${MQ_YEAR}/${encodedDepartment}?page=1`;
    const firstPage = parseListing(await fetchHtml(firstUrl), source.department);
    const pageCount = Math.max(1, Math.ceil(firstPage.total / 50));
    const remainingPages = await mapWithConcurrency(
        Array.from({ length: pageCount - 1 }, (_, index) => index + 2),
        3,
        async (page) =>
            parseListing(
                await fetchHtml(
                    `${UNIT_GUIDE_ORIGIN}/units/show_year/${MQ_YEAR}/${encodedDepartment}?page=${page}`,
                ),
                source.department,
            ).rows,
    );

    return [firstPage.rows, ...remainingPages].flat().filter((row) => source.include(row.subjectCode));
}

function offeringPreference(row) {
    let score = 0;
    if (/North Ryde/i.test(row.offeringLabel)) score += 4;
    if (/In person-scheduled-weekday/i.test(row.offeringLabel)) score += 2;
    if (!/intensive|infrequent/i.test(row.offeringLabel)) score += 1;
    return score;
}

function chooseOneOfferingPerSubjectAndSession(rows) {
    const selected = new Map();

    for (const row of rows) {
        const key = `${row.subjectCode}:${row.session}`;
        const current = selected.get(key);
        if (!current || offeringPreference(row) > offeringPreference(current)) selected.set(key, row);
    }

    return [...selected.values()].sort(
        (left, right) =>
            left.subjectCode.localeCompare(right.subjectCode) || left.session - right.session,
    );
}

function htmlFragmentToText(fragment) {
    return normaliseText(load(`<div>${fragment ?? ''}</div>`)('div').text());
}

function shortExcerpt(text, maximumWords = 25) {
    const words = normaliseText(text).split(' ').filter(Boolean);
    return words.length <= maximumWords
        ? words.join(' ')
        : `${words.slice(0, maximumWords).join(' ')}…`;
}

function parseHandbook(html, fallback) {
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) return fallback;

    const pageContent = JSON.parse(match[1])?.props?.pageProps?.pageContent;
    if (!pageContent) return fallback;

    return {
        subjectName: normaliseText(pageContent.title) || fallback.subjectName,
        subjectDescription: shortExcerpt(htmlFragmentToText(pageContent.description)),
    };
}

function parseUnitGuide(html, offering) {
    const $ = load(html);
    const fallbackDescription = shortExcerpt(
        normaliseText($('.unit-description .general-info-value').first().text()),
    );
    const assessments = [];

    $('#assessment-tasks-section tr.assessment-task-row').each((index, element) => {
        const row = $(element);
        const name = normaliseText(row.find('td.title').text());
        const weight = Number.parseFloat(normaliseText(row.find('td.weighting').text()).replace('%', ''));
        const expectedDue = normaliseText(row.find('td.due').text()).slice(0, 500);
        const detailSelector = row.find('td.title a').attr('href');
        const assessmentType = detailSelector
            ? normaliseText($(detailSelector).find('.info-assessment-type').first().text())
            : '';

        if (!name || !Number.isFinite(weight)) return;

        assessments.push({
            id: deterministicUuid(
                `assessment:${MQ_YEAR}:${offering.session}:${offering.subjectCode}:${offering.sourceOfferingId}:${index}:${name}`,
            ),
            source_offering_id: offering.sourceOfferingId,
            subject_code: offering.subjectCode,
            year: MQ_YEAR,
            session: offering.session,
            name,
            description: assessmentType ? `Assessment type: ${assessmentType}.` : '',
            weight,
            hurdle: /^yes\b/i.test(normaliseText(row.find('td.hurdle').text())),
            is_group: /^group\b/i.test(
                normaliseText(row.find('td.groupwork-individual').text()),
            ),
            expected_due: expectedDue,
            due_at: parseExactDue(expectedDue) ?? '',
            source_url: offering.sourceUrl,
        });
    });

    return { fallbackDescription, assessments };
}

async function main() {
    await mkdir(cacheDirectory, { recursive: true });

    console.log('Discovering public 2026 offerings…');
    const discovered = (
        await mapWithConcurrency(SOURCES, 2, (source) => fetchDepartment(source))
    ).flat();
    const offerings = chooseOneOfferingPerSubjectAndSession(discovered);

    console.log(`Downloading ${offerings.length} unit guides…`);
    const guideData = await mapWithConcurrency(offerings, 5, async (offering, index) => {
        if ((index + 1) % 20 === 0 || index + 1 === offerings.length) {
            console.log(`  unit guides ${index + 1}/${offerings.length}`);
        }
        return parseUnitGuide(await fetchHtml(offering.sourceUrl), offering);
    });

    const subjectFallbacks = new Map();
    for (const [index, offering] of offerings.entries()) {
        const current = subjectFallbacks.get(offering.subjectCode);
        subjectFallbacks.set(offering.subjectCode, {
            subjectName: offering.listingName,
            subjectDescription: current?.subjectDescription || guideData[index].fallbackDescription,
        });
    }

    const subjectCodes = [...subjectFallbacks.keys()].sort();
    console.log(`Downloading ${subjectCodes.length} handbook records…`);
    const subjects = await mapWithConcurrency(subjectCodes, 5, async (subjectCode, index) => {
        if ((index + 1) % 20 === 0 || index + 1 === subjectCodes.length) {
            console.log(`  handbook ${index + 1}/${subjectCodes.length}`);
        }

        const sourceUrl = `${HANDBOOK_ORIGIN}/${MQ_YEAR}/units/${subjectCode}`;
        let handbook = subjectFallbacks.get(subjectCode);
        try {
            handbook = parseHandbook(await fetchHtml(sourceUrl), handbook);
        } catch (error) {
            console.warn(`  handbook fallback for ${subjectCode}: ${error.message}`);
        }

        return {
            id: deterministicUuid(`subject:${MQ_INSTITUTION_NAME}:${subjectCode}`),
            institution_name: MQ_INSTITUTION_NAME,
            subject_code: subjectCode,
            subject_name: handbook.subjectName,
            subject_description: handbook.subjectDescription,
            source_url: sourceUrl,
        };
    });

    const institutionRows = [
        {
            id: deterministicUuid(`institution:${MQ_INSTITUTION_NAME}`),
            name: MQ_INSTITUTION_NAME,
            website: MQ_INSTITUTION_WEBSITE,
        },
    ];
    const termRows = [1, 2].map((session) => ({
        id: deterministicUuid(`term:${MQ_INSTITUTION_NAME}:${MQ_YEAR}:${session}`),
        institution_name: MQ_INSTITUTION_NAME,
        year: MQ_YEAR,
        session,
    }));
    const offeringRows = offerings.map((offering) => ({
        id: deterministicUuid(
            `offering:${MQ_INSTITUTION_NAME}:${MQ_YEAR}:${offering.session}:${offering.subjectCode}`,
        ),
        source_offering_id: offering.sourceOfferingId,
        subject_code: offering.subjectCode,
        year: MQ_YEAR,
        session: offering.session,
        delivery: offering.offeringLabel,
        department: offering.department,
        source_url: offering.sourceUrl,
    }));
    const assessmentRows = guideData.flatMap((result) => result.assessments);

    await writeCsv(path.join(outputDirectory, 'institutions.csv'), ['id', 'name', 'website'], institutionRows);
    await writeCsv(
        path.join(outputDirectory, 'terms.csv'),
        ['id', 'institution_name', 'year', 'session'],
        termRows,
    );
    await writeCsv(
        path.join(outputDirectory, 'subjects.csv'),
        [
            'id',
            'institution_name',
            'subject_code',
            'subject_name',
            'subject_description',
            'source_url',
        ],
        subjects,
    );
    await writeCsv(
        path.join(outputDirectory, 'offerings.csv'),
        [
            'id',
            'source_offering_id',
            'subject_code',
            'year',
            'session',
            'delivery',
            'department',
            'source_url',
        ],
        offeringRows,
    );
    await writeCsv(
        path.join(outputDirectory, 'assessments.csv'),
        [
            'id',
            'source_offering_id',
            'subject_code',
            'year',
            'session',
            'name',
            'description',
            'weight',
            'hurdle',
            'is_group',
            'expected_due',
            'due_at',
            'source_url',
        ],
        assessmentRows,
    );

    const manifest = {
        generatedAt: new Date().toISOString(),
        year: MQ_YEAR,
        sessions: [1, 2],
        sources: {
            handbook: HANDBOOK_ORIGIN,
            unitGuides: UNIT_GUIDE_ORIGIN,
        },
        counts: {
            institutions: institutionRows.length,
            terms: termRows.length,
            subjects: subjects.length,
            offerings: offeringRows.length,
            assessments: assessmentRows.length,
            assessmentsWithExactDueAt: assessmentRows.filter((row) => row.due_at).length,
        },
    };
    await writeFile(
        path.join(outputDirectory, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
    );

    console.log('CSV stage complete:', manifest.counts);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

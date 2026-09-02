import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export const MQ_YEAR = 2026;
export const MQ_INSTITUTION_NAME = 'Macquarie University';
export const MQ_INSTITUTION_WEBSITE = 'https://www.mq.edu.au/';

export function normaliseText(value) {
    return String(value ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function deterministicUuid(key) {
    const bytes = Buffer.from(createHash('sha256').update(`ailearn-seed:${key}`).digest().subarray(0, 16));

    // RFC 4122 variant + version 5 marker. The bytes come from SHA-256 rather than SHA-1, but
    // only UUID shape and deterministic identity matter for seed rows.
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Return the last valid dd/mm/yyyy in a due label, at 23:59 Sydney time. */
export function parseExactDue(expectedDue) {
    const matches = [...String(expectedDue ?? '').matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)];

    for (const match of matches.reverse()) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        const candidate = new Date(Date.UTC(year, month - 1, day));

        if (
            candidate.getUTCFullYear() === year &&
            candidate.getUTCMonth() === month - 1 &&
            candidate.getUTCDate() === day
        ) {
            return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 23:59:00 Australia/Sydney`;
        }
    }

    return null;
}

function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function writeCsv(filePath, columns, rows) {
    const lines = [columns.join(',')];

    for (const row of rows) {
        lines.push(columns.map((column) => csvCell(row[column])).join(','));
    }

    await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
}

export async function readCsv(filePath) {
    const input = await readFile(filePath, 'utf8');
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;

    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];

        if (quoted) {
            if (character === '"' && input[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                field += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            record.push(field);
            field = '';
        } else if (character === '\n') {
            record.push(field.replace(/\r$/, ''));
            if (record.some((value) => value !== '')) records.push(record);
            record = [];
            field = '';
        } else {
            field += character;
        }
    }

    if (field !== '' || record.length > 0) {
        record.push(field.replace(/\r$/, ''));
        records.push(record);
    }

    const [header, ...rows] = records;
    if (!header) return [];

    return rows.map((values) =>
        Object.fromEntries(header.map((column, index) => [column, values[index] ?? ''])),
    );
}

export function sqlString(value) {
    return value === null || value === undefined || value === ''
        ? 'NULL'
        : `'${String(value).replaceAll("'", "''")}'`;
}

export function sqlBoolean(value) {
    return value === true || value === 'true' ? 'TRUE' : 'FALSE';
}

export function sqlTimestamp(value) {
    return value ? `TIMESTAMPTZ ${sqlString(value)}` : 'NULL';
}

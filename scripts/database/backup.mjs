import 'dotenv/config';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { findDocker, runDocker } from './docker-cli.mjs';

const { Client } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const backupDirectory = path.join(projectRoot, 'prisma', 'backups');
const snapshotPath = path.join(backupDirectory, 'ailearn-current.dump');
const manifestPath = path.join(backupDirectory, 'ailearn-current.json');
const databaseName = 'ailearn';

async function readTableCounts() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from .env');

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const tables = await client.query(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename NOT IN ('_prisma_migrations', 'LoginSession')
            ORDER BY tablename
        `);
        const counts = {};
        for (const { tablename } of tables.rows) {
            const quoted = `"${tablename.replaceAll('"', '""')}"`;
            const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${quoted}`);
            counts[tablename] = result.rows[0].count;
        }
        return counts;
    } finally {
        await client.end();
    }
}

async function main() {
    const docker = findDocker();
    runDocker(docker, ['compose', 'up', '-d', '--wait', 'db'], {
        cwd: projectRoot,
        stdio: 'inherit',
    });

    const dump = runDocker(
        docker,
        [
            'compose',
            'exec',
            '-T',
            'db',
            'pg_dump',
            '-U',
            'postgres',
            '-d',
            databaseName,
            '--format=custom',
            '--compress=9',
            '--no-owner',
            '--no-privileges',
            '--exclude-table-data=public."LoginSession"',
        ],
        { cwd: projectRoot, encoding: null },
    ).stdout;

    await mkdir(backupDirectory, { recursive: true });
    await writeFile(snapshotPath, dump);
    await writeFile(
        manifestPath,
        `${JSON.stringify(
            {
                formatVersion: 1,
                generatedAt: new Date().toISOString(),
                database: databaseName,
                excludedData: ['LoginSession'],
                tableCounts: await readTableCounts(),
            },
            null,
            2,
        )}\n`,
    );

    console.log(`Database snapshot written to ${path.relative(projectRoot, snapshotPath)}`);
    console.log('LoginSession rows were intentionally excluded.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findDocker, runDocker } from './docker-cli.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const snapshotPath = path.join(projectRoot, 'prisma', 'backups', 'ailearn-current.dump');
const databaseName = 'ailearn';

async function main() {
    if (!process.argv.includes('--force')) {
        throw new Error(
            'Restore replaces every table in the local ailearn database. Re-run with: pnpm db:restore -- --force',
        );
    }

    const docker = findDocker();
    const snapshot = await readFile(snapshotPath);
    runDocker(docker, ['compose', 'up', '-d', '--wait', 'db'], {
        cwd: projectRoot,
        stdio: 'inherit',
    });

    runDocker(
        docker,
        [
            'compose',
            'exec',
            '-T',
            'db',
            'psql',
            '-v',
            'ON_ERROR_STOP=1',
            '-U',
            'postgres',
            '-d',
            databaseName,
            '-c',
            'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
        ],
        { cwd: projectRoot, stdio: 'inherit' },
    );

    runDocker(
        docker,
        [
            'compose',
            'exec',
            '-T',
            'db',
            'pg_restore',
            '-U',
            'postgres',
            '-d',
            databaseName,
            '--single-transaction',
            '--no-owner',
            '--no-privileges',
        ],
        { cwd: projectRoot, input: snapshot, stdio: ['pipe', 'inherit', 'inherit'] },
    );

    console.log('Database restored from prisma/backups/ailearn-current.dump.');
    console.log('Login sessions are not restored; sign in again on this machine.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

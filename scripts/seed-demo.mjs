/**
 * Chạy toàn bộ file SQL trong `prisma/seedingdata` theo thứ tự tên file.
 *
 * Đặt tiền tố số vào tên file nếu dữ liệu có phụ thuộc, ví dụ:
 *
 *     001-users.sql
 *     010-institutions.sql
 *     020-roles.sql
 *
 * Các thư mục con cũng được quét. Toàn bộ lượt seed dùng chung một transaction, nên chỉ cần
 * một file lỗi là mọi thay đổi của lượt chạy được rollback.
 */
import 'dotenv/config';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedDirectory = path.join(projectRoot, 'prisma', 'seedingdata');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is missing from .env');
}

async function findSqlFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...(await findSqlFiles(entryPath)));
        } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.sql') {
            files.push(entryPath);
        }
    }

    return files;
}

function comparePaths(left, right) {
    const leftPath = path.relative(seedDirectory, left).replaceAll('\\', '/');
    const rightPath = path.relative(seedDirectory, right).replaceAll('\\', '/');

    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
}

async function main() {
    const sqlFiles = (await findSqlFiles(seedDirectory)).sort(comparePaths);

    if (sqlFiles.length === 0) {
        throw new Error(`No .sql files found in ${seedDirectory}`);
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
        await client.query('BEGIN');

        for (const sqlFile of sqlFiles) {
            const relativePath = path.relative(projectRoot, sqlFile).replaceAll('\\', '/');
            const sql = (await readFile(sqlFile, 'utf8')).replace(/^\uFEFF/, '');

            if (sql.trim().length === 0) {
                console.log(`skip  ${relativePath} (empty)`);
                continue;
            }

            console.log(`run   ${relativePath}`);

            try {
                await client.query(sql);
            } catch (error) {
                throw new Error(`Failed to execute ${relativePath}`, { cause: error });
            }
        }

        await client.query('COMMIT');
        console.log(`Seed complete: ${sqlFiles.length} SQL file(s).`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

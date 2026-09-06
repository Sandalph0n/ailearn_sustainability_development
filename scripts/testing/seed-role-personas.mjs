/**
 * Create local-only UI personas for every role in one institution.
 *
 * This script is intentionally not part of `prisma db seed`: production/demo data must never
 * acquire predictable QA accounts. Supply E2E_ROLE_PASSWORD explicitly when running it.
 */
import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import pg from 'pg';

const password = process.env.E2E_ROLE_PASSWORD;
const connectionString = process.env.DATABASE_URL;
const institutionId = process.argv[2] ?? 'f715afb4-9475-5d59-a61f-e66d50c03fdb';

if (!connectionString) throw new Error('DATABASE_URL is missing');
if (!password || password.length < 12) {
    throw new Error('Set E2E_ROLE_PASSWORD to at least 12 characters');
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
    const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
        hashLength: 32,
    });
    await client.query('BEGIN');

    const { rows: roles } = await client.query(
        `SELECT "id", "roleCode", "roleName", "scopeType"
           FROM "Role"
          WHERE "institutionId" = $1
          ORDER BY "roleCode"`,
        [institutionId],
    );
    const { rows: offerings } = await client.query(
        `SELECT offering."id"
           FROM "Offering" offering
           JOIN "Subject" subject ON subject."id" = offering."subjectId"
          WHERE subject."institutionId" = $1
          ORDER BY (
            SELECT COUNT(*) FROM "Assessment" assessment
             WHERE assessment."offeringId" = offering."id"
          ) DESC, offering."id"
          LIMIT 2`,
        [institutionId],
    );

    const personas = [];
    for (const role of roles) {
        const slug = role.roleCode.replace(/[^a-z0-9]+/gi, '.').replace(/^\.|\.$/g, '').toLowerCase();
        const email = `qa+${slug}@ailearn.local`;
        const userResult = await client.query(
            `INSERT INTO "User" ("id", "email", "passwordHash", "firstName", "lastName")
             VALUES ($1, $2, $3, 'QA', $4)
             ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"
             RETURNING "id"`,
            [randomUUID(), email, passwordHash, role.roleName],
        );
        const userId = userResult.rows[0].id;
        let assignmentResult = await client.query(
            `SELECT "id" FROM "RoleAssignment"
              WHERE "userId" = $1 AND "roleId" = $2 AND "roleRevokedAt" IS NULL
              ORDER BY "roleGrantedAt" DESC LIMIT 1`,
            [userId, role.id],
        );
        if (assignmentResult.rowCount === 0) {
            assignmentResult = await client.query(
                `INSERT INTO "RoleAssignment" ("id", "userId", "roleId")
                 VALUES ($1, $2, $3) RETURNING "id"`,
                [randomUUID(), userId, role.id],
            );
        }
        const assignmentId = assignmentResult.rows[0].id;

        if (role.scopeType === 'OFFERING') {
            for (const offering of offerings) {
                await client.query(
                    `INSERT INTO "ScopeAssignment" ("id", "roleAssignmentId", "offeringId", "source", "assignedDirectlyById")
                     SELECT $1, $2, $3, 'DIRECT', $4
                      WHERE NOT EXISTS (
                        SELECT 1 FROM "ScopeAssignment"
                         WHERE "roleAssignmentId" = $2
                           AND "offeringId" = $3
                           AND "revokedAt" IS NULL
                      )`,
                    [randomUUID(), assignmentId, offering.id, userId],
                );
            }
        }
        personas.push({ email, role: role.roleName, scope: role.scopeType });
    }

    const noRoleEmail = 'qa+no-role@ailearn.local';
    await client.query(
        `INSERT INTO "User" ("id", "email", "passwordHash", "firstName", "lastName")
         VALUES ($1, $2, $3, 'QA', 'No Role')
         ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"`,
        [randomUUID(), noRoleEmail, passwordHash],
    );
    personas.unshift({ email: noRoleEmail, role: 'No role', scope: 'NONE' });

    await client.query('COMMIT');
    console.table(personas);
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    await client.end();
}

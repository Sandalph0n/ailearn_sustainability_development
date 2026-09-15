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
const emailDomain = 'lernumi.local';

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
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('lernumi:qa-role-persona-seed'))");

    const { rows: roles } = await client.query(
        `SELECT "id", "roleCode", "roleName", "scopeType"
           FROM "Role"
          WHERE "institutionId" = $1
          ORDER BY "roleCode"`,
        [institutionId],
    );
    const { rows: preferredOfferings } = await client.query(
        `SELECT offering."id", subject."subjectCode", term."year", term."session"
           FROM "Offering" offering
           JOIN "Subject" subject ON subject."id" = offering."subjectId"
           JOIN "StudyTerm" term ON term."id" = offering."termId"
          WHERE subject."institutionId" = $1
            AND subject."subjectCode" = 'COMP1350'
            AND term."year" = 2026
            AND term."session" = 2
          ORDER BY offering."id"
          LIMIT 1`,
        [institutionId],
    );
    const { rows: fallbackOfferings } = preferredOfferings.length > 0
        ? { rows: [] }
        : await client.query(
        `SELECT offering."id", subject."subjectCode", term."year", term."session"
           FROM "Offering" offering
           JOIN "Subject" subject ON subject."id" = offering."subjectId"
           JOIN "StudyTerm" term ON term."id" = offering."termId"
          WHERE subject."institutionId" = $1
          ORDER BY (
            SELECT COUNT(*) FROM "Assessment" assessment
             WHERE assessment."offeringId" = offering."id"
          ) DESC, term."year" DESC, term."session" DESC, offering."id"
          LIMIT 1`,
        [institutionId],
    );
    const offering = preferredOfferings[0] ?? fallbackOfferings[0];
    if (!offering) throw new Error('The institution has no offering for offering-scoped QA roles');

    const personas = [];
    for (const role of roles) {
        const slug = role.roleCode.replace(/[^a-z0-9]+/gi, '.').replace(/^\.|\.$/g, '').toLowerCase();
        const email = `qa+${slug}@${emailDomain}`;
        const userResult = await client.query(
            `INSERT INTO "User" ("id", "email", "passwordHash", "firstName", "lastName")
             VALUES ($1, $2, $3, 'QA', $4)
             ON CONFLICT ("email") DO UPDATE
             SET "passwordHash" = EXCLUDED."passwordHash",
                 "firstName" = EXCLUDED."firstName",
                 "lastName" = EXCLUDED."lastName",
                 "isSystemAdmin" = false
             RETURNING "id"`,
            [randomUUID(), email, passwordHash, role.roleName],
        );
        const userId = userResult.rows[0].id;

        // A persona is useful only when its effective access comes from one role. Revoke any
        // stale assignment left by a renamed/reconfigured catalog before restoring the target.
        await client.query(
            `UPDATE "RoleAssignment"
                SET "roleRevokedAt" = CURRENT_TIMESTAMP
              WHERE "userId" = $1
                AND "roleId" <> $2
                AND "roleRevokedAt" IS NULL`,
            [userId, role.id],
        );
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

        // Defensively collapse duplicate active assignments for the same role to one row.
        await client.query(
            `UPDATE "RoleAssignment"
                SET "roleRevokedAt" = CURRENT_TIMESTAMP
              WHERE "userId" = $1
                AND "roleId" = $2
                AND "roleRevokedAt" IS NULL
                AND "id" <> $3`,
            [userId, role.id, assignmentId],
        );

        if (role.scopeType === 'OFFERING') {
            await client.query(
                `UPDATE "ScopeAssignment"
                    SET "revokedAt" = CURRENT_TIMESTAMP,
                        "revokedById" = $2
                  WHERE "roleAssignmentId" = $1
                    AND "offeringId" <> $3
                    AND "revokedAt" IS NULL`,
                [assignmentId, userId, offering.id],
            );
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
        } else {
            await client.query(
                `UPDATE "ScopeAssignment"
                    SET "revokedAt" = CURRENT_TIMESTAMP,
                        "revokedById" = $2
                  WHERE "roleAssignmentId" = $1
                    AND "revokedAt" IS NULL`,
                [assignmentId, userId],
            );
        }
        personas.push({
            email,
            roleCode: role.roleCode,
            role: role.roleName,
            scope: role.scopeType === 'OFFERING'
                ? `${offering.subjectCode} · ${offering.year} Session ${offering.session}`
                : 'Institution-wide',
        });
    }

    const noRoleEmail = `qa+no-role@${emailDomain}`;
    const noRoleResult = await client.query(
        `INSERT INTO "User" ("id", "email", "passwordHash", "firstName", "lastName")
         VALUES ($1, $2, $3, 'QA', 'No Role')
         ON CONFLICT ("email") DO UPDATE
         SET "passwordHash" = EXCLUDED."passwordHash",
             "firstName" = EXCLUDED."firstName",
             "lastName" = EXCLUDED."lastName",
             "isSystemAdmin" = false
         RETURNING "id"`,
        [randomUUID(), noRoleEmail, passwordHash],
    );
    await client.query(
        `UPDATE "RoleAssignment"
            SET "roleRevokedAt" = CURRENT_TIMESTAMP
          WHERE "userId" = $1
            AND "roleRevokedAt" IS NULL`,
        [noRoleResult.rows[0].id],
    );
    personas.unshift({ email: noRoleEmail, roleCode: 'none', role: 'No role', scope: 'None' });

    await client.query('COMMIT');
    console.table(personas);
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    await client.end();
}

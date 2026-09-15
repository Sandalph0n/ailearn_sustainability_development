/**
 * Remove local-only role QA personas and every database record they own.
 *
 * The target is deliberately fixed to `qa+%@lernumi.local`. Historical `ailearn.local`
 * principals are not touched: some authored immutable tool versions and must remain as audit
 * identities. The cleanup runs in one
 * transaction and aborts if a QA-created access code has granted scope to a non-QA user,
 * because deleting that scope would cross the cleanup boundary.
 */
import 'dotenv/config';

import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is missing');

const client = new pg.Client({ connectionString });
await client.connect();

const deleted = {};

async function deleteRows(name, sql) {
    const result = await client.query(sql);
    deleted[name] = result.rowCount ?? 0;
}

try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('lernumi:qa-role-persona-cleanup'))");

    await client.query(`
        CREATE TEMP TABLE qa_cleanup_users ON COMMIT DROP AS
        SELECT "id", "email"
          FROM "User"
         WHERE "email" LIKE 'qa+%@lernumi.local'
    `);

    const targetResult = await client.query(
        `SELECT "email" FROM qa_cleanup_users ORDER BY "email"`,
    );

    if (targetResult.rowCount === 0) {
        await client.query('COMMIT');
        console.log('No QA role personas found. Nothing to clean.');
    } else {
        await client.query(`
            CREATE TEMP TABLE qa_cleanup_role_assignments ON COMMIT DROP AS
            SELECT assignment."id"
              FROM "RoleAssignment" assignment
              JOIN qa_cleanup_users qa ON qa."id" = assignment."userId"
        `);
        await client.query(`
            CREATE TEMP TABLE qa_cleanup_scope_assignments ON COMMIT DROP AS
            SELECT scope."id"
              FROM "ScopeAssignment" scope
              JOIN qa_cleanup_role_assignments assignment
                ON assignment."id" = scope."roleAssignmentId"
        `);
        await client.query(`
            CREATE TEMP TABLE qa_cleanup_attempts ON COMMIT DROP AS
            SELECT attempt."id"
              FROM "AssessmentAttempt" attempt
              JOIN qa_cleanup_users qa ON qa."id" = attempt."userId"
        `);
        await client.query(`
            CREATE TEMP TABLE qa_cleanup_workspaces ON COMMIT DROP AS
            SELECT personal."workspaceId" AS "id"
              FROM "PersonalWorkspace" personal
              JOIN qa_cleanup_users qa ON qa."id" = personal."userId"
            UNION
            SELECT assignment."workspaceId" AS "id"
              FROM "AssignmentWorkspace" assignment
              JOIN qa_cleanup_attempts attempt ON attempt."id" = assignment."attemptId"
        `);

        const unsafeCodeResult = await client.query(`
            SELECT code."id"
              FROM "ScopeAssignmentCode" code
              JOIN qa_cleanup_users creator ON creator."id" = code."createdById"
              JOIN "ScopeAssignment" scope ON scope."usedCodeId" = code."id"
              LEFT JOIN qa_cleanup_scope_assignments qa_scope ON qa_scope."id" = scope."id"
             WHERE qa_scope."id" IS NULL
             LIMIT 1
        `);
        if (unsafeCodeResult.rowCount > 0) {
            throw new Error(
                `Cleanup aborted: QA-created access code ${unsafeCodeResult.rows[0].id} ` +
                    'has granted scope to a non-QA role assignment.',
            );
        }

        const crossRoleRequestResult = await client.query(`
            SELECT request."id"
              FROM "RoleRequest" request
              JOIN qa_cleanup_role_assignments assignment
                ON assignment."id" = request."approvedAssignmentId"
              LEFT JOIN qa_cleanup_users qa ON qa."id" = request."userId"
             WHERE qa."id" IS NULL
             LIMIT 1
        `);
        if (crossRoleRequestResult.rowCount > 0) {
            throw new Error(
                `Cleanup aborted: non-QA role request ${crossRoleRequestResult.rows[0].id} ` +
                    'references a QA-owned role assignment.',
            );
        }

        const crossScopeRequestResult = await client.query(`
            SELECT request."id"
              FROM "ScopeAssignmentRequest" request
              JOIN qa_cleanup_scope_assignments scope
                ON scope."id" = request."approvedScopeAssignmentId"
              LEFT JOIN qa_cleanup_role_assignments assignment
                ON assignment."id" = request."roleAssignmentId"
             WHERE assignment."id" IS NULL
             LIMIT 1
        `);
        if (crossScopeRequestResult.rowCount > 0) {
            throw new Error(
                `Cleanup aborted: non-QA scope request ${crossScopeRequestResult.rows[0].id} ` +
                    'references a QA-owned scope assignment.',
            );
        }

        await deleteRows(
            'roleRequests',
            `DELETE FROM "RoleRequest"
              WHERE "userId" IN (SELECT "id" FROM qa_cleanup_users)
                 OR "approvedAssignmentId" IN (
                    SELECT "id" FROM qa_cleanup_role_assignments
                 )`,
        );
        // Processed scope requests are immutable in normal application traffic. QA cleanup is a
        // privileged maintenance transaction, so disable only that history trigger while removing
        // records owned by the already-validated QA boundary. PostgreSQL rolls this DDL back too if
        // any later cleanup step fails.
        await client.query(`
            ALTER TABLE "ScopeAssignmentRequest"
            DISABLE TRIGGER "ScopeAssignmentRequest_immutable_history_trigger"
        `);
        await deleteRows(
            'scopeRequests',
            `DELETE FROM "ScopeAssignmentRequest"
              WHERE "roleAssignmentId" IN (
                    SELECT "id" FROM qa_cleanup_role_assignments
                 )
                 OR "approvedScopeAssignmentId" IN (
                    SELECT "id" FROM qa_cleanup_scope_assignments
                 )`,
        );
        await client.query(`
            ALTER TABLE "ScopeAssignmentRequest"
            ENABLE TRIGGER "ScopeAssignmentRequest_immutable_history_trigger"
        `);
        await deleteRows(
            'workspaces',
            `DELETE FROM "Workspace"
              WHERE "id" IN (SELECT "id" FROM qa_cleanup_workspaces)`,
        );
        await deleteRows(
            'attempts',
            `DELETE FROM "AssessmentAttempt"
              WHERE "id" IN (SELECT "id" FROM qa_cleanup_attempts)`,
        );
        await deleteRows(
            'scopeAssignments',
            `DELETE FROM "ScopeAssignment"
              WHERE "id" IN (SELECT "id" FROM qa_cleanup_scope_assignments)`,
        );
        await deleteRows(
            'accessCodes',
            `DELETE FROM "ScopeAssignmentCode"
              WHERE "createdById" IN (SELECT "id" FROM qa_cleanup_users)`,
        );

        // Preserve non-QA records while removing optional audit references to QA actors.
        await client.query(`
            UPDATE "RoleAssignment"
               SET "grantDirectlyById" = NULL
             WHERE "grantDirectlyById" IN (SELECT "id" FROM qa_cleanup_users)
               AND "userId" NOT IN (SELECT "id" FROM qa_cleanup_users)
        `);
        await client.query(`
            UPDATE "ScopeAssignment"
               SET "assignedDirectlyById" = CASE
                       WHEN "assignedDirectlyById" IN (SELECT "id" FROM qa_cleanup_users)
                       THEN NULL ELSE "assignedDirectlyById" END,
                   "revokedById" = CASE
                       WHEN "revokedById" IN (SELECT "id" FROM qa_cleanup_users)
                       THEN NULL ELSE "revokedById" END
             WHERE "assignedDirectlyById" IN (SELECT "id" FROM qa_cleanup_users)
                OR "revokedById" IN (SELECT "id" FROM qa_cleanup_users)
        `);
        await client.query(`
            UPDATE "ScopeAssignmentCode"
               SET "revokedById" = NULL
             WHERE "revokedById" IN (SELECT "id" FROM qa_cleanup_users)
        `);

        await deleteRows(
            'roleAssignments',
            `DELETE FROM "RoleAssignment"
              WHERE "id" IN (SELECT "id" FROM qa_cleanup_role_assignments)`,
        );
        await deleteRows(
            'users',
            `DELETE FROM "User"
              WHERE "id" IN (SELECT "id" FROM qa_cleanup_users)`,
        );

        const remainingResult = await client.query(
            `SELECT COUNT(*)::int AS "count"
               FROM "User"
              WHERE "email" LIKE 'qa+%@lernumi.local'`,
        );
        if (remainingResult.rows[0].count !== 0) {
            throw new Error('Cleanup verification failed: QA role personas still exist');
        }

        await client.query('COMMIT');
        console.log(`Removed ${targetResult.rowCount} QA role persona(s).`);
        console.table(deleted);
    }
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    await client.end();
}

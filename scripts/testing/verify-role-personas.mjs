/**
 * Verify the isolation contract used by browser-based role testing.
 *
 * Every current institution role has one Lernumi QA user. That user has exactly one active role
 * assignment. Institution roles have no offering scope; offering roles have exactly the preferred
 * COMP1350 Session 2 scope. The no-role control has no active assignments.
 */
import 'dotenv/config';

import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const institutionId = process.argv[2] ?? 'f715afb4-9475-5d59-a61f-e66d50c03fdb';

if (!connectionString) throw new Error('DATABASE_URL is missing');

const client = new pg.Client({ connectionString });
await client.connect();

try {
    const { rows } = await client.query(
        `WITH expected_roles AS (
             SELECT role."id",
                    role."roleCode",
                    role."roleName",
                    role."scopeType",
                    'qa+' || regexp_replace(lower(role."roleCode"), '[^a-z0-9]+', '.', 'g') || '@lernumi.local' AS email
               FROM "Role" role
              WHERE role."institutionId" = $1
         ), persona_state AS (
             SELECT expected.*,
                    user_account."id" AS "userId",
                    user_account."isSystemAdmin",
                    COUNT(DISTINCT assignment."id") FILTER (WHERE assignment."roleRevokedAt" IS NULL)::int AS "activeRoles",
                    COUNT(DISTINCT scope."id") FILTER (WHERE scope."revokedAt" IS NULL)::int AS "activeScopes",
                    COUNT(DISTINCT scope."id") FILTER (
                        WHERE scope."revokedAt" IS NULL
                          AND subject."subjectCode" = 'COMP1350'
                          AND term."year" = 2026
                          AND term."session" = 2
                    )::int AS "preferredScopes",
                    BOOL_AND(assignment."roleId" = expected."id") FILTER (
                        WHERE assignment."roleRevokedAt" IS NULL
                    ) AS "onlyExpectedRole"
               FROM expected_roles expected
               LEFT JOIN "User" user_account ON user_account."email" = expected.email
               LEFT JOIN "RoleAssignment" assignment
                      ON assignment."userId" = user_account."id"
                     AND assignment."roleRevokedAt" IS NULL
               LEFT JOIN "ScopeAssignment" scope
                      ON scope."roleAssignmentId" = assignment."id"
                     AND scope."revokedAt" IS NULL
               LEFT JOIN "Offering" offering ON offering."id" = scope."offeringId"
               LEFT JOIN "Subject" subject ON subject."id" = offering."subjectId"
               LEFT JOIN "StudyTerm" term ON term."id" = offering."termId"
              GROUP BY expected."id", expected."roleCode", expected."roleName", expected."scopeType",
                       expected.email, user_account."id", user_account."isSystemAdmin"
         )
         SELECT *
           FROM persona_state
          ORDER BY "roleCode"`,
        [institutionId],
    );

    const failures = rows.filter((row) =>
        !row.userId ||
        row.isSystemAdmin ||
        row.activeRoles !== 1 ||
        row.onlyExpectedRole !== true ||
        (row.scopeType === 'INSTITUTION' && row.activeScopes !== 0) ||
        (row.scopeType === 'OFFERING' && (row.activeScopes !== 1 || row.preferredScopes !== 1)),
    );

    const noRole = await client.query(
        `SELECT user_account."id",
                user_account."isSystemAdmin",
                COUNT(assignment."id") FILTER (WHERE assignment."roleRevokedAt" IS NULL)::int AS "activeRoles"
           FROM "User" user_account
           LEFT JOIN "RoleAssignment" assignment ON assignment."userId" = user_account."id"
          WHERE user_account."email" = 'qa+no-role@lernumi.local'
          GROUP BY user_account."id", user_account."isSystemAdmin"`,
    );
    const noRoleValid = noRole.rowCount === 1 &&
        noRole.rows[0].activeRoles === 0 &&
        noRole.rows[0].isSystemAdmin === false;

    console.table(rows.map((row) => ({
        roleCode: row.roleCode,
        account: row.email,
        roles: row.activeRoles,
        scopes: row.activeScopes,
        result: failures.includes(row) ? 'FAIL' : 'PASS',
    })));
    console.log(`No-role control: ${noRoleValid ? 'PASS' : 'FAIL'}`);

    if (failures.length > 0 || !noRoleValid) {
        throw new Error(`${failures.length + (noRoleValid ? 0 : 1)} QA persona contract(s) failed`);
    }
} finally {
    await client.end();
}

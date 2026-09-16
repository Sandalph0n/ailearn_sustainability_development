import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { applyAutoGrantedRoles } from '../../lib/auth/auto-grant.ts';
import {
    ALL_PERMISSION_CODES,
    hasPermission,
    MARKING_REPLAY_PERMISSION_CODES,
} from '../../lib/auth/permissions.ts';
import { emailSchema } from '../../lib/auth/validation/credentials.ts';

const roleSeed = readFileSync(
    new URL('../../prisma/seedingdata/015-mq-roles.sql', import.meta.url),
    'utf8',
);

function valuesBlock(tableName, endMarker) {
    const match = roleSeed.match(
        new RegExp(
            `INSERT INTO ${tableName} \\([^;]+?\\)\\s*VALUES\\s*([\\s\\S]+?)${endMarker}`,
        ),
    );

    expect(match, `Expected a VALUES block for ${tableName}`).not.toBeNull();
    return match[1];
}

const roles = [
    ...valuesBlock('seed_mq_roles', ';').matchAll(
        /\('([0-9a-f-]{36})',\s*'([^']+)',\s*'([^']+)',\s*'(INSTITUTION|OFFERING)',\s*'([^']+)'\)/g,
    ),
].map((match) => ({
    id: match[1],
    roleCode: match[2],
    roleName: match[3],
    scopeType: match[4],
    requestMode: match[5],
}));

const rolesById = new Map(roles.map((role) => [role.id, role]));
const rolesByCode = new Map(roles.map((role) => [role.roleCode, role]));

const directPermissions = [
    ...valuesBlock(
        'seed_mq_role_permissions',
        ';\\s*\\n\\s*-- Chief Management receives',
    ).matchAll(/\('([0-9a-f-]{36})',\s*'([a-z][a-z0-9_.]+)'\)/g),
].map((match) => ({ roleId: match[1], permission: match[2] }));

const inclusions = [
    ...valuesBlock('seed_mq_role_inclusions', ';').matchAll(
        /\('([0-9a-f-]{36})',\s*'([0-9a-f-]{36})'\)/g,
    ),
].map((match) => ({ includingRoleId: match[1], includedRoleId: match[2] }));

function permissionsFor(roleCode) {
    const role = rolesByCode.get(roleCode);
    expect(role, `Expected role ${roleCode}`).toBeDefined();

    return directPermissions
        .filter(({ roleId }) => roleId === role.id)
        .map(({ permission }) => permission)
        .sort();
}

function includesRole(includingCode, includedCode) {
    const includingRole = rolesByCode.get(includingCode);
    const includedRole = rolesByCode.get(includedCode);

    return inclusions.some(
        (edge) =>
            edge.includingRoleId === includingRole?.id &&
            edge.includedRoleId === includedRole?.id,
    );
}

function effectivePermissionsFor(roleCode) {
    const role = rolesByCode.get(roleCode);
    expect(role, `Expected role ${roleCode}`).toBeDefined();

    const effectiveRoleIds = new Set([role.id]);
    const queue = [role.id];
    for (let index = 0; index < queue.length; index += 1) {
        for (const edge of inclusions) {
            if (
                edge.includingRoleId !== queue[index] ||
                effectiveRoleIds.has(edge.includedRoleId)
            ) {
                continue;
            }
            effectiveRoleIds.add(edge.includedRoleId);
            queue.push(edge.includedRoleId);
        }
    }

    return directPermissions
        .filter(({ roleId }) => effectiveRoleIds.has(roleId))
        .map(({ permission }) => permission);
}

describe('Macquarie role catalog seed', () => {
    it('defines exactly 18 uniquely named role codes using the scope convention', () => {
        expect(roles).toHaveLength(18);
        expect(new Set(roles.map(({ roleCode }) => roleCode)).size).toBe(18);

        for (const role of roles) {
            expect(role.roleCode).toMatch(
                /^(institution|offering):[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/,
            );
            expect(role.roleCode.startsWith('institution:')).toBe(
                role.scopeType === 'INSTITUTION',
            );
            expect(role.roleCode.startsWith('offering:')).toBe(
                role.scopeType === 'OFFERING',
            );
        }
    });

    it('assigns the intended institution and offering scopes', () => {
        const offeringRoles = roles
            .filter(({ scopeType }) => scopeType === 'OFFERING')
            .map(({ roleCode }) => roleCode)
            .sort();

        expect(offeringRoles).toEqual([
            'offering:assessment.manager',
            'offering:offering.manager',
            'offering:student',
            'offering:tutor',
            'offering:unit.convenor',
        ]);
        expect(roles.filter(({ scopeType }) => scopeType === 'INSTITUTION')).toHaveLength(13);

        for (const edge of inclusions) {
            const includingRole = rolesById.get(edge.includingRoleId);
            const includedRole = rolesById.get(edge.includedRoleId);

            expect(includingRole, `Unknown including role ${edge.includingRoleId}`).toBeDefined();
            expect(includedRole, `Unknown included role ${edge.includedRoleId}`).toBeDefined();
            expect(includingRole.scopeType).toBe(includedRole.scopeType);
        }
    });

    it('grants Chief Management the complete application permission catalog', () => {
        const chief = rolesByCode.get('institution:chief.management');
        expect(chief).toBeDefined();

        const dynamicGrant = roleSeed.match(
            /INSERT INTO seed_mq_role_permissions[\s\S]+?SELECT\s+'([0-9a-f-]{36})'::uuid,\s*permission\."permission"[\s\S]+?FROM\s+"Permission"\s+AS\s+permission\s+ON CONFLICT/s,
        );

        expect(dynamicGrant, 'Chief must receive every row from Permission').not.toBeNull();
        expect(dynamicGrant[1]).toBe(chief.id);
        expect(new Set(ALL_PERMISSION_CODES).size).toBe(ALL_PERMISSION_CODES.length);
        expect(ALL_PERMISSION_CODES).toHaveLength(58);
    });

    it('gives Student exactly the minimum learner permissions', () => {
        expect(permissionsFor('offering:student')).toEqual([
            'assessment.attempt',
            'assessment.view_published',
            'attempt.view_own',
            'offering.view',
            'tool.launch',
            'tool_session.replay_own',
        ]);
    });

    it('grants the complete marking workflow only to the intended staff hierarchy', () => {
        const markingRoles = [
            'offering:tutor',
            'offering:assessment.manager',
            'offering:offering.manager',
            'offering:unit.convenor',
            'institution:assessment.manager',
            'institution:offering.manager',
            'institution:academic.operations.manager',
            'institution:administrator',
        ];

        for (const roleCode of markingRoles) {
            const permissions = effectivePermissionsFor(roleCode);
            for (const permission of MARKING_REPLAY_PERMISSION_CODES) {
                expect(
                    hasPermission(permissions, permission),
                    `${roleCode} should receive ${permission}`,
                ).toBe(true);
            }
        }

        const nonMarkingRoles = [
            'offering:student',
            'institution:staff',
            'institution:subject.viewer',
            'institution:subject.editor',
            'institution:subject.manager',
            'institution:term.manager',
            'institution:access.reviewer',
            'institution:access.manager',
            'institution:audit.viewer',
        ];

        for (const roleCode of nonMarkingRoles) {
            expect(
                MARKING_REPLAY_PERMISSION_CODES.some((permission) =>
                    hasPermission(effectivePermissionsFor(roleCode), permission),
                ),
                `${roleCode} should not enter the staff marking workspace`,
            ).toBe(false);
        }
    });

    it.each([
        ['learner@students.mq.edu.au', true],
        ['  Learner@STUDENTS.MQ.EDU.AU  ', true],
        ['staff@mq.edu.au', false],
        ['learner@example.com', false],
        ['learner@students.mq.edu.au.example.com', false],
        ['learner@studentsXmq.edu.au', false],
        ['learner@students.mqXedu.au', false],
        ['learner@students.mq.eduXau', false],
    ])('auto-grants the seeded Student role for %s: %s', async (email, shouldGrant) => {
        const student = rolesByCode.get('offering:student');
        const autoGrant = roleSeed.match(
            /WHEN\s+role\."roleCode"\s*=\s*'offering:student'\s+THEN\s+'([^']+)'/,
        );
        expect(autoGrant, 'Student must have an email auto-grant rule in the seed').not.toBeNull();

        const tx = {
            role: {
                findMany: vi.fn().mockResolvedValue([
                    { id: student.id, autoGrantEmailRegex: autoGrant[1] },
                ]),
            },
            roleAssignment: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
        };
        const userId = 'test-user';
        const grantedRoles = await applyAutoGrantedRoles(tx, userId, emailSchema.parse(email));

        expect(grantedRoles).toEqual(shouldGrant ? [student.id] : []);
        if (shouldGrant) {
            expect(tx.roleAssignment.createMany).toHaveBeenCalledExactlyOnceWith({
                data: [{ userId, roleId: student.id }],
            });
        } else {
            expect(tx.roleAssignment.createMany).not.toHaveBeenCalled();
        }
    });

    it('keeps role inheritance as a same-scope DAG without self-cycles', () => {
        expect(
            inclusions.some(({ includingRoleId, includedRoleId }) =>
                includingRoleId === includedRoleId,
            ),
        ).toBe(false);

        const outgoing = new Map(roles.map(({ id }) => [id, []]));
        const indegree = new Map(roles.map(({ id }) => [id, 0]));

        for (const { includingRoleId, includedRoleId } of inclusions) {
            outgoing.get(includingRoleId).push(includedRoleId);
            indegree.set(includedRoleId, indegree.get(includedRoleId) + 1);
        }

        const queue = [...indegree]
            .filter(([, degree]) => degree === 0)
            .map(([id]) => id);
        let visited = 0;

        while (queue.length > 0) {
            const roleId = queue.shift();
            visited += 1;

            for (const includedRoleId of outgoing.get(roleId)) {
                const nextDegree = indegree.get(includedRoleId) - 1;
                indegree.set(includedRoleId, nextDegree);
                if (nextDegree === 0) queue.push(includedRoleId);
            }
        }

        expect(visited).toBe(roles.length);
    });

    it('contains the Subject Viewer, Editor and Manager inheritance ladder', () => {
        expect(rolesByCode.get('institution:subject.viewer')?.roleName).toBe('Subject Viewer');
        expect(rolesByCode.get('institution:subject.editor')?.roleName).toBe('Subject Editor');
        expect(rolesByCode.get('institution:subject.manager')?.roleName).toBe('Subject Manager');

        expect(includesRole('institution:subject.editor', 'institution:subject.viewer')).toBe(true);
        expect(includesRole('institution:subject.manager', 'institution:subject.editor')).toBe(true);
        expect(permissionsFor('institution:subject.viewer')).toEqual(['subject.view']);
        expect(permissionsFor('institution:subject.editor')).toEqual([
            'subject.create',
            'subject.update',
        ]);
        expect(permissionsFor('institution:subject.manager')).toEqual(['subject.delete']);
    });
});

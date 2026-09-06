import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    ALL_PERMISSION_CODES,
    MANAGE_PERMISSION_BUNDLES,
    PERMISSION_CATALOG,
    PERMISSION_CODE,
    assertPermissionCode,
    hasEveryPermission,
    hasPermission,
    isPermissionCode,
} from './permissions';

describe('permission catalog', () => {
    it('contains exactly 57 unique codes with complete metadata', () => {
        expect(ALL_PERMISSION_CODES).toHaveLength(57);
        expect(new Set(ALL_PERMISSION_CODES).size).toBe(57);
        expect(Object.keys(PERMISSION_CATALOG).sort()).toEqual([...ALL_PERMISSION_CODES].sort());
        expect(Object.values(PERMISSION_CATALOG).every(({ description }) => description.length > 0))
            .toBe(true);
    });

    it('narrows and rejects permission strings at runtime boundaries', () => {
        expect(isPermissionCode(PERMISSION_CODE.ASSESSMENT_ATTEMPT)).toBe(true);
        expect(isPermissionCode('assessment.delete_everything')).toBe(false);
        expect(() => assertPermissionCode('assessment.delete_everything')).toThrow(
            'Unknown permission code',
        );
    });

    it('matches every row inserted by the permission data migration', () => {
        const migration = readFileSync(
            new URL(
                '../../prisma/migrations/20260907091000_authorization_permission_catalog/migration.sql',
                import.meta.url,
            ),
            'utf8',
        );
        const rows = [
            ...migration.matchAll(
                /\(\s*'([a-z][a-z0-9_.]*)',\s*'((?:''|[^'])*)'\s*\)/g,
            ),
        ].map((match) => [
            match[1],
            { description: match[2].replaceAll("''", "'") },
        ] as const);

        expect(rows).toHaveLength(57);
        expect(new Set(rows.map(([code]) => code)).size).toBe(57);
        expect(Object.fromEntries(rows)).toEqual(
            Object.fromEntries(
                ALL_PERMISSION_CODES.map((code) => [code, PERMISSION_CATALOG[code]]),
            ),
        );
    });

    it('expands manage permissions into their granular actions', () => {
        expect(
            hasPermission(
                [PERMISSION_CODE.SUBJECT_MANAGE],
                PERMISSION_CODE.SUBJECT_DELETE,
            ),
        ).toBe(true);
        expect(
            hasPermission(
                [PERMISSION_CODE.OFFERING_MANAGE],
                PERMISSION_CODE.OFFERING_CREATE,
            ),
        ).toBe(false);
        expect(
            hasPermission(
                [PERMISSION_CODE.ROLE_REQUEST_REVIEW],
                PERMISSION_CODE.ROLE_REQUEST_APPROVE,
            ),
        ).toBe(true);
        expect(
            hasPermission(
                [PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_MANAGE],
                PERMISSION_CODE.SCOPE_ASSIGNMENT_CODE_REVOKE,
            ),
        ).toBe(true);
    });

    it('lets full assessment viewers read published assessments without reversing the grant', () => {
        expect(
            hasPermission(
                [PERMISSION_CODE.ASSESSMENT_VIEW],
                PERMISSION_CODE.ASSESSMENT_VIEW_PUBLISHED,
            ),
        ).toBe(true);
        expect(
            hasPermission(
                [PERMISSION_CODE.ASSESSMENT_VIEW_PUBLISHED],
                PERMISSION_CODE.ASSESSMENT_VIEW,
            ),
        ).toBe(false);
        expect(
            hasPermission(
                [PERMISSION_CODE.ASSESSMENT_MANAGE],
                PERMISSION_CODE.ASSESSMENT_VIEW_PUBLISHED,
            ),
        ).toBe(true);
    });

    it('recognizes a manage capability only when every granular action is present', () => {
        const subjectActions = MANAGE_PERMISSION_BUNDLES[PERMISSION_CODE.SUBJECT_MANAGE];

        expect(hasPermission(subjectActions, PERMISSION_CODE.SUBJECT_MANAGE)).toBe(true);
        expect(
            hasPermission(subjectActions.slice(0, -1), PERMISSION_CODE.SUBJECT_MANAGE),
        ).toBe(false);
        expect(
            hasEveryPermission([PERMISSION_CODE.SUBJECT_MANAGE], subjectActions),
        ).toBe(true);
    });
});

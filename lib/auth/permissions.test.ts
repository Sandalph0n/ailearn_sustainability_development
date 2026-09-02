import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PermissionType, RoleScopeType } from '../../app/generated/prisma/enums';
import {
    ALL_PERMISSION_CODES,
    PERMISSION_CATALOG,
    PERMISSION_CODE,
    assertPermissionCode,
    canRoleScopeUsePermission,
    isPermissionCode,
} from './permissions';

describe('permission catalog', () => {
    it('contains exactly 20 unique codes with complete metadata', () => {
        expect(ALL_PERMISSION_CODES).toHaveLength(20);
        expect(new Set(ALL_PERMISSION_CODES).size).toBe(20);
        expect(Object.keys(PERMISSION_CATALOG).sort()).toEqual([...ALL_PERMISSION_CODES].sort());
        expect(Object.values(PERMISSION_CATALOG).every(({ description }) => description.length > 0))
            .toBe(true);
    });

    it('keeps the expected institution and offering applicability split', () => {
        const definitions = Object.values(PERMISSION_CATALOG);

        expect(definitions.filter(({ type }) => type === PermissionType.I)).toHaveLength(8);
        expect(definitions.filter(({ type }) => type === PermissionType.IO)).toHaveLength(12);
    });

    it('narrows and rejects permission strings at runtime boundaries', () => {
        expect(isPermissionCode(PERMISSION_CODE.ASSESSMENT_ATTEMPT)).toBe(true);
        expect(isPermissionCode('assessment.delete_everything')).toBe(false);
        expect(() => assertPermissionCode('assessment.delete_everything')).toThrow(
            'Unknown permission code',
        );
    });

    it('allows institution roles to use every permission and offering roles to use only IO', () => {
        expect(
            ALL_PERMISSION_CODES.every((permission) =>
                canRoleScopeUsePermission(RoleScopeType.INSTITUTION, permission),
            ),
        ).toBe(true);
        expect(
            canRoleScopeUsePermission(
                RoleScopeType.OFFERING,
                PERMISSION_CODE.INSTITUTION_SETTINGS_MANAGE,
            ),
        ).toBe(false);
        expect(
            canRoleScopeUsePermission(
                RoleScopeType.OFFERING,
                PERMISSION_CODE.ASSESSMENT_VIEW,
            ),
        ).toBe(true);
    });

    it('matches every row inserted by the permission data migration', () => {
        const migration = readFileSync(
            new URL(
                '../../prisma/migrations/20260902000000_permission_catalog/migration.sql',
                import.meta.url,
            ),
            'utf8',
        );
        const rows = [
            ...migration.matchAll(
                /\(\s*'([a-z][a-z0-9_.]*)',\s*'(I|IO)',\s*'((?:''|[^'])*)'\s*\)/g,
            ),
        ].map((match) => [
            match[1],
            { type: match[2], description: match[3].replaceAll("''", "'") },
        ] as const);

        expect(rows).toHaveLength(20);
        expect(new Set(rows.map(([code]) => code)).size).toBe(20);
        expect(Object.fromEntries(rows)).toEqual(
            Object.fromEntries(
                ALL_PERMISSION_CODES.map((code) => [code, PERMISSION_CATALOG[code]]),
            ),
        );
    });
});

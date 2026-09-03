import { describe, expect, it } from 'vitest';

import type { ContextOption } from '../context/context-params';
import {
    effectivePermissionCodes,
    findSelectedContext,
} from './authorization-policy';
import { PERMISSION_CODE } from './permissions';

describe('authorization policy', () => {
    it('resolves a diamond role graph without duplicate permissions', () => {
        const inclusions = [
            { includingRoleId: 'manager', includedRoleId: 'editor' },
            { includingRoleId: 'manager', includedRoleId: 'reviewer' },
            { includingRoleId: 'editor', includedRoleId: 'viewer' },
            { includingRoleId: 'reviewer', includedRoleId: 'viewer' },
        ];
        const grants = [
            { roleId: 'manager', permission: PERMISSION_CODE.SUBJECT_DELETE },
            { roleId: 'editor', permission: PERMISSION_CODE.SUBJECT_UPDATE },
            { roleId: 'reviewer', permission: PERMISSION_CODE.SUBJECT_VIEW },
            { roleId: 'viewer', permission: PERMISSION_CODE.SUBJECT_VIEW },
            { roleId: 'unrelated', permission: PERMISSION_CODE.SUBJECT_CREATE },
        ];

        expect(effectivePermissionCodes('manager', inclusions, grants)).toEqual([
            PERMISSION_CODE.SUBJECT_DELETE,
            PERMISSION_CODE.SUBJECT_UPDATE,
            PERMISSION_CODE.SUBJECT_VIEW,
        ]);
    });

    it('matches all context dimensions and never falls back', () => {
        const context: ContextOption = {
            assignmentId: 'assignment',
            institution: { id: 'institution', name: 'Institution' },
            role: { id: 'role', roleName: 'Editor', scopeType: 'INSTITUTION' },
            offering: null,
        };

        expect(
            findSelectedContext([context], {
                institutionId: 'institution',
                roleId: 'role',
                offeringId: null,
            }),
        ).toBe(context);
        expect(
            findSelectedContext([context], {
                institutionId: 'another-institution',
                roleId: 'role',
                offeringId: null,
            }),
        ).toBeNull();
    });
});

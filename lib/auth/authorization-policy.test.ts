import { describe, expect, it } from 'vitest';

import type { ContextOption } from '../context/context-params';
import {
    effectivePermissionCodes,
    findContextForTarget,
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
            institution: { id: 'institution', name: 'Institution', logoKey: null },
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

    it('lets institution roles cover every offering but keeps offering roles in assigned scope', () => {
        const institutionContext: ContextOption = {
            assignmentId: 'institution-assignment',
            institution: { id: 'institution', name: 'Institution', logoKey: null },
            role: {
                id: 'institution-role',
                roleName: 'Institution manager',
                scopeType: 'INSTITUTION',
            },
            offering: null,
        };
        const offeringContext: ContextOption = {
            assignmentId: 'offering-assignment',
            institution: { id: 'institution', name: 'Institution', logoKey: null },
            role: {
                id: 'offering-role',
                roleName: 'Tutor',
                scopeType: 'OFFERING',
            },
            offering: {
                id: 'offering-1',
                subjectCode: 'COMP1000',
                subjectName: 'Programming',
                year: 2026,
                session: 1,
            },
        };
        const contexts = [institutionContext, offeringContext];

        expect(
            findContextForTarget(
                contexts,
                { institutionId: 'institution', roleId: 'institution-role' },
                { kind: 'OFFERING', institutionId: 'institution', offeringId: 'offering-99' },
            ),
        ).toBe(institutionContext);
        expect(
            findContextForTarget(
                contexts,
                { institutionId: 'institution', roleId: 'offering-role' },
                { kind: 'OFFERING', institutionId: 'institution', offeringId: 'offering-1' },
            ),
        ).toBe(offeringContext);
        expect(
            findContextForTarget(
                contexts,
                { institutionId: 'institution', roleId: 'offering-role' },
                { kind: 'OFFERING', institutionId: 'institution', offeringId: 'offering-2' },
            ),
        ).toBeNull();
        expect(
            findContextForTarget(
                contexts,
                { institutionId: 'institution', roleId: 'offering-role' },
                { kind: 'INSTITUTION', institutionId: 'institution' },
            ),
        ).toBeNull();
    });
});

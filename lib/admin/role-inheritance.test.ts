import { describe, expect, it } from 'vitest';

import { effectivePermissionIdsByRole } from './role-inheritance';

describe('effectivePermissionIdsByRole', () => {
    it('includes direct and transitive permissions without diamond duplicates', () => {
        const result = effectivePermissionIdsByRole([
            {
                id: 'manager',
                includedRoleIds: ['editor', 'reviewer'],
                directPermissionIds: ['delete'],
            },
            {
                id: 'editor',
                includedRoleIds: ['viewer'],
                directPermissionIds: ['update'],
            },
            {
                id: 'reviewer',
                includedRoleIds: ['viewer'],
                directPermissionIds: ['review'],
            },
            { id: 'viewer', includedRoleIds: [], directPermissionIds: ['view'] },
        ]);

        expect(result.get('manager')).toEqual(['delete', 'review', 'update', 'view']);
        expect(result.get('editor')).toEqual(['update', 'view']);
    });
});

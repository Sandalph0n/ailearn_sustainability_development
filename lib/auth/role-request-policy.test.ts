import { describe, expect, it } from 'vitest';

import { canSeeRoleRequest, effectiveRoleIds } from './role-request-policy';

describe('role request visibility', () => {
    it('shows a role with no visibility requirements to everyone', () => {
        expect(canSeeRoleRequest([], new Set())).toBe(true);
    });

    it('uses OR semantics when a role has several requirements', () => {
        expect(canSeeRoleRequest(['staff', 'admin'], new Set(['staff']))).toBe(true);
        expect(canSeeRoleRequest(['staff', 'admin'], new Set(['student']))).toBe(false);
    });

    it('counts roles inherited through a diamond as roles the user holds', () => {
        const held = effectiveRoleIds(['convenor'], [
            { includingRoleId: 'convenor', includedRoleId: 'lecturer' },
            { includingRoleId: 'convenor', includedRoleId: 'tutor' },
            { includingRoleId: 'lecturer', includedRoleId: 'staff' },
            { includingRoleId: 'tutor', includedRoleId: 'staff' },
        ]);

        expect([...held]).toEqual(['convenor', 'lecturer', 'tutor', 'staff']);
        expect(canSeeRoleRequest(['staff'], held)).toBe(true);
    });
});

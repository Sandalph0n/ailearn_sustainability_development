import { describe, expect, it } from 'vitest';

import { canRequestRole, effectiveRoleIds } from './role-request-policy';

describe('role request visibility', () => {
    it('allows public roles without visibility requirements', () => {
        expect(canRequestRole('PUBLIC', [], new Set())).toBe(true);
    });

    it('never exposes disabled roles, even when a visibility rule matches', () => {
        expect(canRequestRole('DISABLED', ['staff'], new Set(['staff']))).toBe(false);
    });

    it('keeps a conditional role closed when it has no visibility rules', () => {
        expect(canRequestRole('CONDITIONAL', [], new Set(['staff']))).toBe(false);
    });

    it('uses OR semantics when a role has several requirements', () => {
        expect(canRequestRole('CONDITIONAL', ['staff', 'admin'], new Set(['staff']))).toBe(
            true,
        );
        expect(canRequestRole('CONDITIONAL', ['staff', 'admin'], new Set(['student']))).toBe(
            false,
        );
    });

    it('counts roles inherited through a diamond as roles the user holds', () => {
        const held = effectiveRoleIds(['convenor'], [
            { includingRoleId: 'convenor', includedRoleId: 'lecturer' },
            { includingRoleId: 'convenor', includedRoleId: 'tutor' },
            { includingRoleId: 'lecturer', includedRoleId: 'staff' },
            { includingRoleId: 'tutor', includedRoleId: 'staff' },
        ]);

        expect([...held]).toEqual(['convenor', 'lecturer', 'tutor', 'staff']);
        expect(canRequestRole('CONDITIONAL', ['staff'], held)).toBe(true);
    });
});

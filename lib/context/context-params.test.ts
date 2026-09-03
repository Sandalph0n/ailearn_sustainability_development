import { describe, expect, it } from 'vitest';

import { contextKey, contextLabel, distinctRoleContexts, type ContextOption } from './context-params';

function option(offeringId: string | null): ContextOption {
    return {
        assignmentId: 'assignment-1',
        institution: { id: 'institution-1', name: 'Macquarie University' },
        role: {
            id: offeringId ? 'student-role' : 'staff-role',
            roleName: offeringId ? 'Student' : 'Staff',
            scopeType: offeringId ? 'OFFERING' : 'INSTITUTION',
        },
        offering: offeringId
            ? {
                  id: offeringId,
                  subjectCode: 'COMP1000',
                  subjectName: 'Introduction to Computer Programming',
                  year: 2026,
                  session: 1,
              }
            : null,
    };
}

describe('contextKey', () => {
    it('distinguishes offering contexts created by the same role assignment', () => {
        expect(contextKey(option('offering-1'))).not.toBe(contextKey(option('offering-2')));
    });

    it('keeps an institution context stable', () => {
        expect(contextKey(option(null))).toBe('assignment-1:no-offering');
    });
});

describe('role navigation', () => {
    it('shows one entry per role assignment even when it has many offering scopes', () => {
        const first = option('offering-1');
        const second = option('offering-2');

        expect(distinctRoleContexts([first, second])).toEqual([first]);
        expect(contextLabel(first)).toBe('Student');
    });
});

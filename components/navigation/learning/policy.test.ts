import { describe, expect, it } from 'vitest';

import type { AuthorizedContextOption } from '../../../lib/context/context-params';
import { PERMISSION_CODE } from '../../../lib/auth/permissions';
import {
    accessCoversOffering,
    canViewPublishedAssessments,
    isPublishedAt,
    learningAccessForSelector,
    learningAccessWithPermission,
    termStatus,
} from './policy';

function context(
    overrides: Partial<AuthorizedContextOption> &
        Pick<AuthorizedContextOption, 'assignmentId'>,
): AuthorizedContextOption {
    return {
        assignmentId: overrides.assignmentId,
        institution: overrides.institution ?? { id: 'institution-a', name: 'Institution A' },
        role: overrides.role ?? {
            id: 'role-a',
            roleName: 'Student',
            scopeType: 'OFFERING',
        },
        offering: overrides.offering ?? null,
        permissions: overrides.permissions ?? [],
    };
}

describe('learning access policy', () => {
    it('lets an institution role cover every offering in its institution', () => {
        const access = learningAccessForSelector(
            [
                context({
                    assignmentId: 'assignment-a',
                    role: { id: 'role-a', roleName: 'Staff', scopeType: 'INSTITUTION' },
                }),
            ],
            { institutionId: 'institution-a', roleId: 'role-a' },
        );

        expect(access).not.toBeNull();
        expect(accessCoversOffering(access!, 'any-offering')).toBe(true);
    });

    it('folds every offering scope of one assignment without borrowing another assignment', () => {
        const contexts = [
            context({
                assignmentId: 'assignment-a',
                offering: {
                    id: 'offering-1',
                    subjectCode: 'COMP1000',
                    subjectName: 'Introduction',
                    year: 2026,
                    session: 1,
                },
            }),
            context({
                assignmentId: 'assignment-a',
                offering: {
                    id: 'offering-2',
                    subjectCode: 'COMP1010',
                    subjectName: 'Fundamentals',
                    year: 2026,
                    session: 2,
                },
            }),
            context({
                assignmentId: 'assignment-b',
                role: { id: 'role-b', roleName: 'Tutor', scopeType: 'OFFERING' },
                offering: {
                    id: 'offering-3',
                    subjectCode: 'COMP2000',
                    subjectName: 'Systems',
                    year: 2026,
                    session: 2,
                },
            }),
        ];

        const access = learningAccessForSelector(contexts, {
            institutionId: 'institution-a',
            roleId: 'role-a',
            offeringId: 'offering-2',
        });

        expect(accessCoversOffering(access!, 'offering-1')).toBe(true);
        expect(accessCoversOffering(access!, 'offering-2')).toBe(true);
        expect(accessCoversOffering(access!, 'offering-3')).toBe(false);
    });

    it('does not fall back when the URL selects an inaccessible offering', () => {
        const contexts = [
            context({
                assignmentId: 'assignment-a',
                offering: {
                    id: 'offering-1',
                    subjectCode: 'COMP1000',
                    subjectName: 'Introduction',
                    year: 2026,
                    session: 1,
                },
            }),
        ];

        expect(
            learningAccessForSelector(contexts, {
                institutionId: 'institution-a',
                roleId: 'role-a',
                offeringId: 'offering-other',
            }),
        ).toBeNull();
    });

    it('requires offering.view for the subject list', () => {
        const contexts = [context({ assignmentId: 'assignment-a', permissions: [] })];
        expect(
            learningAccessWithPermission(
                contexts,
                { institutionId: 'institution-a', roleId: 'role-a' },
                PERMISSION_CODE.OFFERING_VIEW,
            ),
        ).toBeNull();
    });

    it('treats full assessment viewing as including published assessment viewing', () => {
        const access = learningAccessForSelector(
            [
                context({
                    assignmentId: 'assignment-a',
                    permissions: [PERMISSION_CODE.ASSESSMENT_VIEW],
                }),
            ],
            { institutionId: 'institution-a', roleId: 'role-a' },
        );
        expect(canViewPublishedAssessments(access!)).toBe(true);
    });
});

describe('learning visibility dates', () => {
    const now = new Date('2026-09-07T00:00:00.000Z');

    it('only considers an assessment published once publishAt is reached', () => {
        expect(isPublishedAt(null, now)).toBe(false);
        expect(isPublishedAt('2026-09-07T00:00:00.000Z', now)).toBe(true);
        expect(isPublishedAt('2026-09-07T00:00:01.000Z', now)).toBe(false);
    });

    it('classifies terms from their actual period bounds', () => {
        expect(
            termStatus(
                {
                    year: 2026,
                    periods: [
                        {
                            startAt: '2026-07-20T00:00:00.000Z',
                            endAt: '2026-11-10T00:00:00.000Z',
                        },
                    ],
                },
                now,
            ),
        ).toBe('current');
        expect(
            termStatus(
                {
                    year: 2025,
                    periods: [
                        {
                            startAt: '2025-01-01T00:00:00.000Z',
                            endAt: '2025-12-01T00:00:00.000Z',
                        },
                    ],
                },
                now,
            ),
        ).toBe('past');
    });
});

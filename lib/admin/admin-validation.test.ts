import { describe, expect, it } from 'vitest';

import { AssessmentSchema } from './assessment-schema';
import { InstitutionSchema } from './institution-schema';
import { parseListParams, parseOptionalUuid } from './list-params';
import { RoleAssignmentSchema } from './role-assignment-schema';
import { RoleSchema } from './role-schema';
import { TermPeriodSchema } from './term-period-schema';

const INSTITUTION_ID = '11111111-1111-4111-8111-111111111111';
const ROLE_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_ROLE_ID = '33333333-3333-4333-8333-333333333333';
const TOOL_ID = '44444444-4444-4444-8444-444444444444';

describe('admin validation', () => {
    it('accepts only http and https institution websites', () => {
        expect(
            InstitutionSchema.safeParse({ name: 'Example University', website: 'https://example.edu' })
                .success,
        ).toBe(true);
        expect(
            InstitutionSchema.safeParse({ name: 'Example University', website: 'javascript:alert(1)' })
                .success,
        ).toBe(false);
        expect(InstitutionSchema.parse({ name: 'Example University', website: '' }).website).toBeNull();
    });

    it('rejects duplicate role graph edges and invalid email auto-grant scope', () => {
        const base = {
            institutionId: INSTITUTION_ID,
            roleCode: 'offering:tutor',
            roleName: 'Tutor',
            scopeType: 'OFFERING' as const,
            autoGrantEmailRegex: '',
            includedRoleIds: [ROLE_ID],
            permissionIds: [],
        };

        expect(RoleSchema.safeParse({ ...base, includedRoleIds: [ROLE_ID, ROLE_ID] }).success).toBe(
            false,
        );
        expect(RoleSchema.safeParse({ ...base, autoGrantEmailRegex: '@example\\.edu$' }).success).toBe(
            false,
        );
        expect(
            RoleSchema.safeParse({
                ...base,
                roleCode: 'institution:tutor',
            }).success,
        ).toBe(false);
        expect(
            RoleSchema.safeParse({
                ...base,
                scopeType: 'INSTITUTION',
                roleCode: 'institution:tutor',
                autoGrantEmailRegex: '@example\\.edu$',
                includedRoleIds: [ROLE_ID, SECOND_ROLE_ID],
            }).success,
        ).toBe(true);
    });

    it('normalises assessment form values and validates its timeline', () => {
        const valid = AssessmentSchema.parse({
            name: 'Project',
            description: '  Build a tool  ',
            weight: '40',
            hurdle: true,
            isGroup: false,
            publishAt: '2026-09-01T09:00',
            dueAt: '2026-09-10T17:00',
            expectedDue: '  End of week 6  ',
            toolIds: [TOOL_ID],
        });

        expect(valid.weight).toBe(40);
        expect(valid.description).toBe('Build a tool');
        expect(valid.expectedDue).toBe('End of week 6');
        expect(valid.publishAt).toBeInstanceOf(Date);
        expect(valid.dueAt).toBeInstanceOf(Date);

        expect(
            AssessmentSchema.parse({ ...valid, publishAt: '', dueAt: '', expectedDue: 'Week 12' }),
        ).toMatchObject({ publishAt: null, dueAt: null, expectedDue: 'Week 12' });

        expect(
            AssessmentSchema.safeParse({
                ...valid,
                publishAt: '2026-09-11T09:00',
                dueAt: '2026-09-10T17:00',
            }).success,
        ).toBe(false);
        expect(
            AssessmentSchema.safeParse({
                ...valid,
                publishAt: '',
                dueAt: '2026-09-10T17:00',
                toolIds: [TOOL_ID, TOOL_ID],
            }).success,
        ).toBe(false);
    });

    it('requires a term period to end after it starts', () => {
        expect(
            TermPeriodSchema.safeParse({
                name: 'Break',
                type: 'BREAK',
                startAt: '2026-09-10T09:00',
                endAt: '2026-09-09T17:00',
            }).success,
        ).toBe(false);
    });

    it('normalises institution scope in role assignments', () => {
        const result = RoleAssignmentSchema.parse({
            userId: INSTITUTION_ID,
            roleId: ROLE_ID,
            offeringId: 'institution',
        });
        expect(result.offeringId).toBeNull();
    });

    it('allows an offering role to be granted before it has a scope', () => {
        for (const offeringId of [null, '', 'unscoped']) {
            const result = RoleAssignmentSchema.parse({
                userId: INSTITUTION_ID,
                roleId: ROLE_ID,
                offeringId,
            });
            expect(result.offeringId).toBeNull();
        }
    });

    it('sanitises list and UUID query parameters', () => {
        const parsed = parseListParams(
            { q: '  tutor ', page: '-5', sort: 'passwordHash', dir: 'sideways' },
            ['name', 'createdAt'] as const,
        );
        expect(parsed).toMatchObject({ q: 'tutor', page: 1, sort: 'name', dir: 'asc', skip: 0 });
        expect(parseOptionalUuid(INSTITUTION_ID)).toBe(INSTITUTION_ID);
        expect(parseOptionalUuid('11111111-1111-1111-1111-11111111111z')).toBeNull();
    });
});

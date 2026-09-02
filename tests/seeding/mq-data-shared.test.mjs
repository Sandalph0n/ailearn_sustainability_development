import { describe, expect, it } from 'vitest';

import { deterministicUuid, parseExactDue } from '../../scripts/seeding/mq-data-shared.mjs';

describe('Macquarie seed data helpers', () => {
    it('accepts only valid dd/mm/yyyy dates and places them at 23:59 Sydney time', () => {
        expect(parseExactDue('Submit by 07/09/2026')).toBe(
            '2026-09-07 23:59:00 Australia/Sydney',
        );
        expect(parseExactDue('Submit by 7/9/2026')).toBeNull();
        expect(parseExactDue('Submit by 31/02/2026')).toBeNull();
        expect(parseExactDue('Week 7')).toBeNull();
    });

    it('uses the final valid date when the source publishes a date range', () => {
        expect(parseExactDue('Available 01/05/2026 through 05/05/2026')).toBe(
            '2026-05-05 23:59:00 Australia/Sydney',
        );
    });

    it('generates stable, valid UUID-shaped identifiers', () => {
        const first = deterministicUuid('subject:COMP1000');
        expect(first).toBe(deterministicUuid('subject:COMP1000'));
        expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
});

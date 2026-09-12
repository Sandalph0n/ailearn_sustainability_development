import { describe, expect, it } from 'vitest';

import { unquoteEtag } from './client';

describe('unquoteEtag', () => {
    it('accepts strong and weak HTTP entity tags', () => {
        expect(unquoteEtag('"abc"')).toBe('abc');
        expect(unquoteEtag('W/"abc"')).toBe('abc');
        expect(unquoteEtag('abc')).toBe('abc');
        expect(unquoteEtag(null)).toBeNull();
    });
});

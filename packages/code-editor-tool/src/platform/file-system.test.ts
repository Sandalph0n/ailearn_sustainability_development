import { describe, expect, it } from 'vitest';

import { normalizePath, splitPath } from './path';

describe('workspace path helpers', () => {
    it('normalizes separators and root', () => {
        expect(normalizePath('/src//editor.ts')).toBe('/src/editor.ts');
        expect(normalizePath('')).toBe('/');
    });

    it('splits direct and nested children', () => {
        expect(splitPath('/index.ts')).toEqual({ parentPath: '/', name: 'index.ts' });
        expect(splitPath('/src/index.ts')).toEqual({ parentPath: '/src', name: 'index.ts' });
    });

    it('rejects traversal segments', () => {
        expect(() => normalizePath('/src/../secret')).toThrow();
    });
});

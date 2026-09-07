import { describe, expect, it } from 'vitest';

import { normalizeDocumentName, normalizeDocumentPath } from './document-path';

describe('normalizeDocumentPath', () => {
    it('normalizes separators and duplicate slashes', () => {
        expect(normalizeDocumentPath('./src\\lib//main.ts')).toBe('src/lib/main.ts');
    });

    it.each(['', '/root.txt', '../secret', 'a/../secret', 'a/./b'])('rejects unsafe path %s', (path) => {
        expect(normalizeDocumentPath(path)).toBeNull();
    });

    it('accepts a single entry name and rejects path-shaped names', () => {
        expect(normalizeDocumentName('  report.pdf  ')).toBe('report.pdf');
        expect(normalizeDocumentName('nested/report.pdf')).toBeNull();
        expect(normalizeDocumentName('..')).toBeNull();
    });
});

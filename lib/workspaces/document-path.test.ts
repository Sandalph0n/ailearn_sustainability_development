import { describe, expect, it } from 'vitest';

import { normalizeDocumentPath } from './document-path';

describe('normalizeDocumentPath', () => {
    it('normalizes separators and duplicate slashes', () => {
        expect(normalizeDocumentPath('./src\\lib//main.ts')).toBe('src/lib/main.ts');
    });

    it.each(['', '/root.txt', '../secret', 'a/../secret', 'a/./b'])('rejects unsafe path %s', (path) => {
        expect(normalizeDocumentPath(path)).toBeNull();
    });
});

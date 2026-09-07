import { describe, expect, it } from 'vitest';

import {
    documentBaseName,
    documentParentPath,
    joinDocumentPath,
    normalizeDocumentPath,
} from '../../lib/workspaces/document-path';

describe('workspace document paths', () => {
    it('normalizes separators without allowing traversal', () => {
        expect(normalizeDocumentPath('./src\\components//page.tsx')).toBe(
            'src/components/page.tsx',
        );
        expect(normalizeDocumentPath('../secret.txt')).toBeNull();
        expect(normalizeDocumentPath('/absolute.txt')).toBeNull();
    });

    it('derives parent paths and names for explorer navigation', () => {
        expect(documentParentPath('src/components/page.tsx')).toBe('src/components');
        expect(documentParentPath('README.md')).toBe('');
        expect(documentBaseName('src/components/page.tsx')).toBe('page.tsx');
    });

    it('joins a new entry to the current folder safely', () => {
        expect(joinDocumentPath('src/components', 'button.tsx')).toBe(
            'src/components/button.tsx',
        );
        expect(joinDocumentPath('', 'README.md')).toBe('README.md');
        expect(joinDocumentPath('src', '../secret.txt')).toBeNull();
    });
});

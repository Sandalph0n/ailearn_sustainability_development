import { describe, expect, it } from 'vitest';

import { buildToolRuntimeUrl } from './runtime-url';

describe('tool runtime launch URL', () => {
    it('encodes archive path segments and keeps credentials in the fragment', () => {
        const result = buildToolRuntimeUrl(
            'code-editor',
            '10000000-0000-4000-8000-000000000001',
            'release files/index #1.html',
            'signed.token/value',
        );
        const url = new URL(result, 'https://ailearn.test');

        expect(url.pathname).toBe(
            '/tools/code-editor/10000000-0000-4000-8000-000000000001/release%20files/index%20%231.html',
        );
        expect(url.search).toBe('');
        expect(new URLSearchParams(url.hash.slice(1)).get('ailearn_token')).toBe(
            'signed.token/value',
        );
    });
});

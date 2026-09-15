import { describe, expect, it } from 'vitest';

import {
    clampDescription,
    createMacquarieAdapter,
    handbookUrl,
    htmlToText,
    parseHandbookPage,
} from './macquarie';

/** Khung tối thiểu giống trang Handbook thật: Next.js nhét dữ liệu vào `__NEXT_DATA__`. */
function handbookHtml(pageContent: Record<string, unknown> | null): string {
    const data = { props: { pageProps: pageContent ? { pageContent } : {} } };
    return `<html><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;
}

const COMP1000 = {
    code: 'COMP1000',
    title: 'Introduction to Computer Programming',
    implementation_year: '2026',
    description:
        '<p>This unit is an <strong>introductory</strong> computer science unit.</p><p>Students &amp; staff use Java&nbsp;&#8212; a lot.</p>',
};

describe('macquarie handbook parsing', () => {
    it('reads code, title, year and plain-text description from __NEXT_DATA__', () => {
        expect(parseHandbookPage(handbookHtml(COMP1000))).toEqual({
            code: 'COMP1000',
            title: 'Introduction to Computer Programming',
            year: 2026,
            description:
                'This unit is an introductory computer science unit. Students & staff use Java — a lot.',
        });
    });

    it('returns null when the page is not a unit page', () => {
        expect(parseHandbookPage('<html><body>Maintenance</body></html>')).toBeNull();
        expect(parseHandbookPage(handbookHtml(null))).toBeNull();
        expect(parseHandbookPage(handbookHtml({ code: 'COMP1000' }))).toBeNull();
    });

    it('strips tags and decodes entities', () => {
        expect(htmlToText('<ul><li>One</li><li>Two &lt; three</li></ul>')).toBe('One Two < three');
    });

    it('clamps long descriptions at a word boundary', () => {
        const long = Array.from({ length: 300 }, (_, index) => `word${index}`).join(' ');
        const clamped = clampDescription(long, 100);
        expect(clamped).not.toBeNull();
        expect(clamped!.length).toBeLessThanOrEqual(100);
        expect(clamped!.endsWith('…')).toBe(true);
        // Mỗi mảnh trước dấu "…" phải là một từ nguyên vẹn của đầu vào.
        const words = clamped!.slice(0, -1).split(' ');
        expect(words).toEqual(long.split(' ').slice(0, words.length));
        expect(clampDescription('   ')).toBeNull();
        expect(clampDescription('short')).toBe('short');
    });
});

describe('macquarie adapter', () => {
    it('matches only Macquarie websites', () => {
        const adapter = createMacquarieAdapter();
        expect(adapter.matchesWebsite('https://www.mq.edu.au/')).toBe(true);
        expect(adapter.matchesWebsite('https://mq.edu.au')).toBe(true);
        expect(adapter.matchesWebsite('https://www.unsw.edu.au/')).toBe(false);
        expect(adapter.matchesWebsite('not a url')).toBe(false);
    });

    it('normalises the code, then falls back to the previous year on 404', async () => {
        const requested: string[] = [];
        const adapter = createMacquarieAdapter(async (url) => {
            requested.push(url);
            return url === handbookUrl('COMP1000', 2025)
                ? { status: 200, html: handbookHtml({ ...COMP1000, implementation_year: '2025' }) }
                : { status: 404, html: '' };
        });

        const result = await adapter.findSubject(' comp1000 ', { year: 2026 });
        expect(requested).toEqual([handbookUrl('COMP1000', 2026), handbookUrl('COMP1000', 2025)]);
        expect(result).toEqual({
            ok: true,
            subject: {
                subjectCode: 'COMP1000',
                subjectName: 'Introduction to Computer Programming',
                subjectDescription:
                    'This unit is an introductory computer science unit. Students & staff use Java — a lot.',
                year: 2025,
                sourceUrl: handbookUrl('COMP1000', 2025),
            },
        });
    });

    it('reports not_found after both years miss and unavailable on network failure', async () => {
        const missing = createMacquarieAdapter(async () => ({ status: 404, html: '' }));
        expect(await missing.findSubject('ZZZZ9999', { year: 2026 })).toEqual({
            ok: false,
            reason: 'not_found',
        });

        const down = createMacquarieAdapter(async () => {
            throw new Error('timeout');
        });
        expect(await down.findSubject('COMP1010', { year: 2026 })).toEqual({
            ok: false,
            reason: 'unavailable',
        });

        const changed = createMacquarieAdapter(async () => ({
            status: 200,
            html: '<html>new markup</html>',
        }));
        expect(await changed.findSubject('COMP1020', { year: 2026 })).toEqual({
            ok: false,
            reason: 'unavailable',
        });
    });
});

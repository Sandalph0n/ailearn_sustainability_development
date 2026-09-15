// File này đọc thông tin môn từ Handbook công khai của Macquarie.
//
// Cùng nguồn với `scripts/seeding/fetch-mq-2026.mjs`, nhưng chỉ phần tra cứu MỘT môn theo mã —
// Handbook có URL trực tiếp `/<năm>/units/<MÃ>`, nên không cần lật listing như Unit Guides.
import type { CatalogAdapter, CatalogLookupResult, CatalogSubject } from './types';

const HANDBOOK_ORIGIN = 'https://coursehandbook.mq.edu.au';
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Khớp với `Subject.subjectDescription` trong `lib/admin/subject-schema.ts`. */
const MAX_DESCRIPTION_LENGTH = 1_000;

const REQUEST_HEADERS = {
    'user-agent': 'Lernumi curriculum importer/1.0',
    accept: 'text/html,application/xhtml+xml',
};

type HtmlPage = { status: number; html: string };
type FetchHtml = (url: string) => Promise<HtmlPage>;

async function fetchHandbookHtml(url: string): Promise<HtmlPage> {
    const response = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
    });
    return { status: response.status, html: response.ok ? await response.text() : '' };
}

/**
 * Cache trong bộ nhớ theo `năm:mã`.
 *
 * Handbook là dữ liệu tĩnh theo năm; một giờ là đủ để người dùng bấm thử vài lần mà không phải
 * tải lại trang, và ngắn đủ để không giữ bản cũ khi MQ sửa mô tả.
 */
const cache = new Map<string, { expiresAt: number; result: CatalogLookupResult }>();

function normaliseText(value: unknown): string {
    return String(value ?? '')
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

/**
 * Chuyển đoạn HTML mô tả thành văn bản thuần.
 *
 * Không kéo cheerio vào runtime chỉ vì một trường: mô tả Handbook là vài thẻ `<p>` và `<li>`,
 * regex bóc thẻ rồi giải mã entity là đủ.
 */
export function htmlToText(fragment: string): string {
    const withBreaks = fragment
        .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '');
    const decoded = withBreaks.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
        if (entity[0] === '#') {
            const codePoint =
                entity[1]?.toLowerCase() === 'x'
                    ? Number.parseInt(entity.slice(2), 16)
                    : Number.parseInt(entity.slice(1), 10);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }
        return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    });
    return normaliseText(decoded);
}

/** Cắt ở ranh giới từ để không đứt giữa chữ; thêm dấu "…" để người đọc biết còn nữa. */
export function clampDescription(
    text: string,
    maximumLength = MAX_DESCRIPTION_LENGTH,
): string | null {
    const clean = normaliseText(text);
    if (!clean) return null;
    if (clean.length <= maximumLength) return clean;

    const cut = clean.slice(0, maximumLength - 1);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > maximumLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type HandbookPage = {
    code: string;
    title: string;
    description: string;
    year: number | null;
};

/**
 * Handbook là một ứng dụng Next.js, nên toàn bộ dữ liệu trang nằm trong `__NEXT_DATA__` dưới
 * dạng JSON — đọc JSON ổn định hơn nhiều so với dò DOM.
 *
 * Trả về `null` khi trang không phải trang môn (markup đổi, hoặc trang lỗi trả 200).
 */
export function parseHandbookPage(html: string): HandbookPage | null {
    const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!match) return null;

    let pageContent: Record<string, unknown> | undefined;
    try {
        pageContent = JSON.parse(match[1])?.props?.pageProps?.pageContent;
    } catch {
        return null;
    }
    if (!pageContent || typeof pageContent !== 'object') return null;

    const code = normaliseText(pageContent.code).toUpperCase();
    const title = normaliseText(pageContent.title);
    if (!code || !title) return null;

    const year = Number.parseInt(String(pageContent.implementation_year ?? ''), 10);

    return {
        code,
        title,
        description: htmlToText(String(pageContent.description ?? '')),
        year: Number.isFinite(year) ? year : null,
    };
}

export function handbookUrl(code: string, year: number): string {
    return `${HANDBOOK_ORIGIN}/${year}/units/${encodeURIComponent(code)}`;
}

/** `fetchHtml` tách ra để test không phải chạm mạng. */
export function createMacquarieAdapter(fetchHtml: FetchHtml = fetchHandbookHtml): CatalogAdapter {
    async function lookupYear(code: string, year: number): Promise<CatalogLookupResult> {
        const url = handbookUrl(code, year);
        let page: HtmlPage;
        try {
            page = await fetchHtml(url);
        } catch (error) {
            console.warn(`Macquarie handbook unreachable for ${code} (${year})`, error);
            return { ok: false, reason: 'unavailable' };
        }

        if (page.status === 404) return { ok: false, reason: 'not_found' };
        if (page.status < 200 || page.status >= 300) return { ok: false, reason: 'unavailable' };

        const parsed = parseHandbookPage(page.html);
        if (!parsed) return { ok: false, reason: 'unavailable' };

        const subject: CatalogSubject = {
            subjectCode: parsed.code,
            subjectName: parsed.title,
            subjectDescription: clampDescription(parsed.description),
            year: parsed.year ?? year,
            sourceUrl: url,
        };
        return { ok: true, subject };
    }

    return {
        id: 'macquarie',
        label: 'Macquarie Handbook',
        matchesWebsite: (website) => {
            try {
                const host = new URL(website).hostname.toLowerCase();
                return host === 'mq.edu.au' || host.endsWith('.mq.edu.au');
            } catch {
                return false;
            }
        },
        async findSubject(code, options = {}) {
            const normalisedCode = normaliseText(code).toUpperCase();
            const year = options.year ?? new Date().getFullYear();
            const cacheKey = `${year}:${normalisedCode}`;

            const cached = cache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) return cached.result;

            // Đầu năm Handbook mới có thể chưa lên; môn năm ngoái vẫn tốt hơn là không có gì.
            let result = await lookupYear(normalisedCode, year);
            if (!result.ok && result.reason === 'not_found') {
                result = await lookupYear(normalisedCode, year - 1);
            }

            // Không cache lỗi tạm thời — lần bấm sau nên được thử lại.
            if (result.ok || result.reason === 'not_found') {
                cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
            }
            return result;
        },
    };
}

export const macquarieAdapter = createMacquarieAdapter();

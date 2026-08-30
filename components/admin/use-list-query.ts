'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebounceValue } from 'usehooks-ts';

/**
 * Giữ tham số của một bảng danh sách trong URL.
 *
 * ─── Ba mảnh phải phối hợp ───────────────────────────────────────────────────
 *
 * 1. `useState` cho ô nhập — nó phải phản hồi tức thì theo từng phím gõ, không đợi ai.
 * 2. `useDebounceValue` hoãn giá trị đó lại — không có nó thì mỗi phím là một truy vấn database.
 * 3. `useTransition` đánh dấu việc điều hướng là "không gấp" — React giữ nguyên bảng CŨ trên màn
 *    hình trong lúc server dựng trang mới, thay vì xoá trắng rồi vẽ lại.
 *
 * Thiếu mảnh thứ ba là chỗ dễ bỏ sót nhất: bảng sẽ chớp sang rỗng sau mỗi phím gõ, và cảm giác
 * còn tệ hơn lọc chậm.
 *
 * ─── Vì sao `replace` chứ không phải `push` ──────────────────────────────────
 *
 * Gõ "macquarie" bằng `push` sẽ nhét chín mục vào lịch sử trình duyệt, và người dùng phải bấm
 * Back chín lần mới thoát ra. `replace` thay tại chỗ, nên Back đưa họ về trang trước đó thật.
 */
export function useListQuery() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const currentQuery = searchParams.get('q') ?? '';

    // Ô nhập giữ giá trị riêng để gõ không bị khựng; URL mới là nguồn sự thật.
    const [input, setInput] = useState(currentQuery);
    const [debounced] = useDebounceValue(input, 300);
    const previousQuery = useRef(currentQuery);
    const syncingFromUrl = useRef(false);

    /**
     * Ghi một bộ tham số vào URL.
     *
     * Giá trị rỗng thì XOÁ khoá đi thay vì để `?q=`. URL sạch chia sẻ dễ hơn, và nó khớp với
     * `parseListParams` — thiếu khoá và khoá rỗng đều rơi về cùng một mặc định.
     */
    const setParams = useCallback(
        (next: Record<string, string | number | null>) => {
            const params = new URLSearchParams(searchParams.toString());

            for (const [key, value] of Object.entries(next)) {
                if (value === null || value === '') {
                    params.delete(key);
                } else {
                    params.set(key, String(value));
                }
            }

            startTransition(() => {
                // `scroll: false` — đổi bộ lọc không nên giật người dùng lên đầu trang.
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            });
        },
        [pathname, router, searchParams],
    );

    // Back/Forward có thể thay URL mà không đi qua ô nhập. Đánh dấu lần đồng bộ này để effect
    // ghi URL bên dưới không lập tức đẩy giá trị cũ ngược trở lại.
    useEffect(() => {
        if (previousQuery.current === currentQuery) return;
        previousQuery.current = currentQuery;

        if (currentQuery !== debounced) {
            syncingFromUrl.current = true;
            setInput(currentQuery);
        }
    }, [currentQuery, debounced]);

    // Đồng bộ giá trị đã hoãn vào URL. Bỏ qua khi nó đã bằng URL — nếu không thì mỗi lần
    // `searchParams` đổi lại kích hoạt một lượt điều hướng nữa, thành vòng lặp.
    useEffect(() => {
        if (syncingFromUrl.current) {
            if (debounced === currentQuery) syncingFromUrl.current = false;
            return;
        }
        if (debounced === currentQuery) return;
        // Đổi từ khoá thì phải về trang 1: đang ở trang 5 mà lọc còn 2 trang sẽ ra bảng trống.
        setParams({ q: debounced, page: null });
    }, [debounced, currentQuery, setParams]);

    return {
        /** Giá trị hiện trong ô nhập. */
        input,
        setInput,
        /** Đang chờ server dựng lại trang. Dùng để làm mờ bảng, không phải để xoá nó. */
        isPending,
        setParams,
        sort: searchParams.get('sort'),
        dir: searchParams.get('dir') === 'desc' ? ('desc' as const) : ('asc' as const),
        page: Number(searchParams.get('page') ?? 1),
    };
}

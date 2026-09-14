'use client';

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';

/**
 * Lựa chọn giao diện sáng/tối, nhớ lại giữa các lần vào.
 *
 * ─── Vì sao là class `.dark` chứ không phải `data-theme` ─────────────────────
 *
 * Tài liệu Next (`preventing-flash-before-hydration`) minh hoạ bằng `data-theme`, nhưng
 * `globals.css` bên này khai `@custom-variant dark (&:is(.dark *))` — mọi biến thể `dark:` của
 * Tailwind đều móc vào class. Đổi sang thuộc tính thì phải sửa lại toàn bộ bảng token.
 *
 * ─── Vì sao `useSyncExternalStore` chứ không phải `useState` + `useEffect` ───
 *
 * `localStorage` là một kho nằm ngoài React. Cách quen tay — dựng state rồi đọc kho trong effect
 * và `setState` — bị chính lint của React chặn (`react-hooks/set-state-in-effect`), vì nó gây
 * thêm một lượt dựng thừa sau mỗi lần gắn.
 *
 * `useSyncExternalStore` sinh ra cho đúng tình huống này: `getServerSnapshot` trả về `system` cho
 * máy chủ, `getSnapshot` đọc kho thật ở trình duyệt, và React tự lo phần chênh lệch giữa hai bên
 * mà không báo lỗi ngậm nước.
 *
 * Kèm một món lợi: nghe luôn sự kiện `storage`, nên đổi giao diện ở một thẻ thì các thẻ khác của
 * cùng trang web đổi theo.
 *
 * ─── Vì sao `colorScheme` ────────────────────────────────────────────────────
 *
 * Nó là thứ duy nhất trình duyệt nghe theo cho phần nó tự vẽ: thanh cuộn, ô chọn ngày, nút tăng
 * giảm số. Thiếu nó thì trang tối nhưng thanh cuộn vẫn trắng.
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

/**
 * Chạy đồng bộ trong `<head>`, TRƯỚC khung hình đầu tiên — nếu đợi React thì người dùng thấy một
 * nháy trắng rồi mới chuyển sang tối.
 *
 * `try/catch` vì `localStorage` ném lỗi ở chế độ ẩn danh và khi người dùng chặn dữ liệu trang.
 * Hỏng thì rơi về giao diện theo hệ điều hành, không làm gãy trang.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    STORAGE_KEY,
)})||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(e){}})()`;

function isTheme(value: unknown): value is Theme {
    return value === 'light' || value === 'dark' || value === 'system';
}

/** Người đăng ký của chính thẻ này. Sự kiện `storage` chỉ bắn sang thẻ KHÁC, không bắn cho thẻ ghi. */
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange);
    window.addEventListener('storage', onStoreChange);
    return () => {
        listeners.delete(onStoreChange);
        window.removeEventListener('storage', onStoreChange);
    };
}

function getSnapshot(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isTheme(stored) ? stored : 'system';
    } catch {
        return 'system';
    }
}

/** Máy chủ không có kho nào để đọc, nên luôn là `system`. */
function getServerSnapshot(): Theme {
    return 'system';
}

function applyTheme(theme: Theme) {
    const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function useTheme() {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setTheme = useCallback((next: Theme) => {
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Lưu hỏng thì lựa chọn không sống qua lần tải sau — vẫn hơn là ném lỗi ra giao diện.
        }
        for (const listener of listeners) listener();
    }, []);

    return { theme, setTheme };
}

/**
 * Đặt ở root layout. Việc duy nhất của nó là đồng bộ lựa chọn xuống thẻ `<html>` — bản thân trạng
 * thái nằm ở kho ngoài phía trên, nên đây không phải một context provider.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const { theme } = useTheme();

    useEffect(() => {
        applyTheme(theme);

        // Chỉ khi chọn "System" mới cần nghe hệ điều hành đổi ý giữa chừng.
        if (theme !== 'system') return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applyTheme('system');
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [theme]);

    return children;
}

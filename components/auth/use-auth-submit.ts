'use client';

import { useRouter } from 'next/navigation';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

import { readNextPathFromLocation } from '@/lib/auth/next-path';

/** Hình dạng lỗi mà `lib/auth/http/response.ts` trả về. */
type AuthErrorBody = {
    error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
    };
};

/**
 * Gửi biểu mẫu đăng nhập/đăng ký, và đưa lỗi từ server về đúng ô nhập.
 *
 * ─── Vì sao vẫn phải xử lý lỗi dù đã có Zod ở client ─────────────────────────
 *
 * Zod ở client bắt được lỗi định dạng, nhưng có những chuyện chỉ server biết: email đã có người
 * dùng, mật khẩu sai. Những lỗi đó về theo `error.fields` và cần gắn vào đúng ô, chứ không phải
 * hiện chung chung ở đầu biểu mẫu.
 *
 * ─── Vì sao `router.refresh()` sau khi `push` ────────────────────────────────
 *
 * Cookie phiên do phản hồi của API đặt, nhưng Next đã cache sẵn cây server component dựng lúc
 * chưa đăng nhập. Thiếu `refresh()` thì trang đích có thể vẽ lại từ bản cache đó và trông như
 * vẫn chưa đăng nhập.
 */
export function useAuthSubmit<TValues extends FieldValues>(
    endpoint: string,
    form: UseFormReturn<TValues>,
) {
    const router = useRouter();

    return async function submit(values: TValues) {
        let response: Response;

        try {
            response = await fetch(endpoint, {
                method: 'POST',
                // Bắt buộc JSON — `readAuthJson` phía server từ chối mọi content-type khác, và đó
                // là một trong các lớp chống CSRF.
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
        } catch {
            // Mất mạng, server chết. Không có phản hồi nào để đọc.
            form.setError('root', { message: 'Cannot reach the server. Check your connection.' });
            return;
        }

        if (response.ok) {
            router.push(readNextPathFromLocation());
            router.refresh();
            return;
        }

        // Thân lỗi có thể không phải JSON (ví dụ trang lỗi của proxy ở tầng trên), nên đọc phòng thủ.
        const body: AuthErrorBody = await response.json().catch(() => ({}));
        const fields = body.error?.fields;

        if (fields) {
            for (const [name, messages] of Object.entries(fields)) {
                const message = messages[0];
                if (!message) continue;

                // `_form` là quy ước của `formatValidationErrors` cho lỗi không thuộc ô nào.
                if (name === '_form') {
                    form.setError('root', { message });
                } else {
                    form.setError(name as Path<TValues>, { message });
                }
            }
        }

        // Luôn để lại một thông báo ở mức biểu mẫu, kể cả khi đã gắn lỗi vào từng ô — nếu không,
        // lỗi kiểu 401 hay 500 (vốn không có `fields`) sẽ trôi qua mà người dùng không thấy gì.
        if (!fields || body.error?.code === 'INVALID_CREDENTIALS') {
            form.setError('root', {
                message: body.error?.message ?? 'Something went wrong. Please try again.',
            });
        }
    };
}

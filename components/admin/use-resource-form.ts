'use client';

import { useRouter } from 'next/navigation';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

/** Hình dạng lỗi mà `lib/auth/http/response.ts` trả về. */
type ApiErrorBody = {
    error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
    };
};

/**
 * Gửi một biểu mẫu quản trị, đưa lỗi server về đúng ô, rồi làm mới danh sách.
 *
 * ─── Vì sao `router.refresh()` chứ không tự sửa mảng ở client ────────────────
 *
 * Danh sách do Server Component đọc thẳng từ database. `refresh()` bảo Next dựng lại cây đó và
 * gửi xuống bản mới, giữ nguyên trạng thái phía client (ô tìm kiếm, trang đang xem).
 *
 * Cách kia — tự chèn/xoá phần tử trong mảng — thì phải chép lại logic sắp xếp và lọc ở client,
 * và mọi trường server tự sinh (`id`, `createdAt`, giá trị đã chuẩn hoá) đều phải đoán. Với bảng
 * quản trị vài trăm dòng thì một vòng làm mới rẻ hơn nhiều so với chỗ dễ sai đó.
 *
 * ─── Vì sao trả về `boolean` ────────────────────────────────────────────────
 *
 * Chỗ gọi cần biết có nên rời editor hay không. Thất bại thì giữ nguyên editor, lỗi đã nằm sẵn
 * trong biểu mẫu để người dùng sửa mà không mất những gì vừa gõ.
 */
export function useResourceForm<
    TFieldValues extends FieldValues,
    TContext = unknown,
    TTransformed extends FieldValues = TFieldValues,
>(form: UseFormReturn<TFieldValues, TContext, TTransformed>) {
    const router = useRouter();

    return async function submit(
        url: string,
        method: 'POST' | 'PATCH',
        values: TTransformed,
    ): Promise<boolean> {
        form.clearErrors('root');

        let response: Response;
        try {
            response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
        } catch {
            form.setError('root', { message: 'Cannot reach the server. Check your connection.' });
            return false;
        }

        if (response.ok) {
            router.refresh();
            return true;
        }

        const body: ApiErrorBody = await response.json().catch(() => ({}));
        const fields = body.error?.fields;

        if (fields) {
            for (const [name, messages] of Object.entries(fields)) {
                const message = messages[0];
                if (!message) continue;

                // `_form` là quy ước của `formatValidationErrors` cho lỗi không thuộc ô nào.
                if (name === '_form') {
                    form.setError('root', { message });
                } else {
                    form.setError(name as Path<TFieldValues>, { message });
                }
            }
            return false;
        }

        // Lỗi không kèm `fields` (404, 409, 500) không gắn được vào ô nào — hiện ở đầu biểu mẫu.
        form.setError('root', {
            message: body.error?.message ?? 'Something went wrong. Please try again.',
        });
        return false;
    };
}

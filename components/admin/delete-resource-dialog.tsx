'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';

/**
 * Hỏi lại trước khi xoá, dùng chung cho mọi thực thể quản trị.
 *
 * ─── Vì sao KHÔNG kiểm trước xem có xoá được không ──────────────────────────
 *
 * Database mới là tiếng nói cuối. Nhiều quan hệ gắn `Restrict` — bài đã nộp, tài khoản đã hoạt
 * động — nên phép xoá bị chặn ở tầng đó và route trả về 409 kèm câu giải thích. Chép luật ấy
 * sang client chỉ tạo ra một bản sao sẽ lệch dần.
 *
 * Việc của hộp thoại này là: nói rõ hệ quả TRƯỚC, rồi hiện nguyên văn lời từ chối nếu có.
 */
export function DeleteResourceDialog({
    endpoint,
    title,
    description,
    trigger,
}: {
    /** Đường dẫn đầy đủ tới bản ghi, ví dụ `/api/admin/tools/<id>`. */
    endpoint: string;
    title: string;
    /** Nói rõ cái gì sẽ mất theo. "Are you sure?" trơn không cho người dùng gì để quyết định. */
    description: ReactNode;
    trigger: ReactElement;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function confirmDelete() {
        setDeleting(true);
        setError(null);

        try {
            const response = await fetch(endpoint, { method: 'DELETE' });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setError(body?.error?.message ?? 'Could not delete this.');
                setDeleting(false);
                return;
            }
        } catch {
            setError('Cannot reach the server. Check your connection.');
            setDeleting(false);
            return;
        }

        setDeleting(false);
        setOpen(false);
        router.refresh();
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                // Đóng rồi mở lại không nên thấy lỗi của lần trước.
                if (!next) setError(null);
            }}
        >
            <AlertDialogTrigger nativeButton={false} render={trigger} />

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>

                {error && (
                    <div
                        role="alert"
                        className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
                    >
                        {error}
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        disabled={deleting}
                        // Mặc định nút này đóng hộp thoại ngay khi bấm. Phải chặn lại để giữ nó
                        // mở cho tới khi server trả lời, nếu không thì lỗi 409 không kịp hiện.
                        onClick={(event) => {
                            event.preventDefault();
                            void confirmDelete();
                        }}
                    >
                        {deleting && <Spinner />}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

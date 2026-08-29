'use client';

import { useState, type ReactElement } from 'react';
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

export type InstitutionDeleteTarget = {
    id: string;
    name: string;
    /** Số bản ghi con sẽ bị xoá theo. Dùng để cảnh báo trước, không phải để chặn. */
    counts: { subjects: number; terms: number; roles: number };
};

/**
 * Hỏi lại trước khi xoá một cơ sở giáo dục.
 *
 * ─── Vì sao phải liệt kê số lượng ────────────────────────────────────────────
 *
 * `Subject`, `StudyTerm`, `Role`, `RoleRequest` đều `onDelete: Cascade` về `Institution`, và
 * chuỗi đó chảy tiếp xuống `Offering` rồi `Assessment`. Một cú bấm có thể quét sạch nhiều thứ
 * hơn hẳn những gì tên hộp thoại gợi ý.
 *
 * Câu "Are you sure?" trơn không cho người dùng thêm thông tin gì để quyết định. Con số thì có.
 *
 * ─── Vì sao không chặn sẵn khi có dữ liệu con ────────────────────────────────
 *
 * Database đã có tiếng nói cuối: `AssessmentAttempt` gắn `Restrict` nên cơ sở nào từng có bài
 * nộp thì không xoá được, và route trả về 409. Kiểm trước ở client chỉ là bản sao của luật đó,
 * và bản sao thì sẽ lệch.
 */
export function DeleteInstitutionDialog({
    institution,
    trigger,
}: {
    institution: InstitutionDeleteTarget;
    trigger: ReactElement;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cascade = [
        { count: institution.counts.subjects, label: 'subject' },
        { count: institution.counts.terms, label: 'term' },
        { count: institution.counts.roles, label: 'role' },
    ].filter((item) => item.count > 0);

    async function confirmDelete() {
        setDeleting(true);
        setError(null);

        try {
            const response = await fetch(`/api/admin/institutions/${institution.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setError(body?.error?.message ?? 'Could not delete this institution.');
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
                // Đóng rồi mở lại thì không nên thấy lỗi của lần trước.
                if (!next) setError(null);
            }}
        >
            <AlertDialogTrigger render={trigger} />

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {institution.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {cascade.length > 0 ? (
                            <>
                                This also deletes{' '}
                                {cascade.map((item, index) => (
                                    <span key={item.label}>
                                        {index > 0 &&
                                            (index === cascade.length - 1 ? ' and ' : ', ')}
                                        <strong className="text-foreground">
                                            {item.count} {item.label}
                                            {item.count === 1 ? '' : 's'}
                                        </strong>
                                    </span>
                                ))}
                                , along with everything inside them. This cannot be undone.
                            </>
                        ) : (
                            'This institution has no subjects, terms or roles. This cannot be undone.'
                        )}
                    </AlertDialogDescription>
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
                        // `nativeButton` mặc định đóng hộp thoại ngay khi bấm. Ta cần giữ nó mở
                        // cho tới khi server trả lời, để hiện được lỗi nếu phép xoá bị từ chối.
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

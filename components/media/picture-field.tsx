'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, Upload01Icon } from '@hugeicons/core-free-icons';

import { pictureUrl } from '@/components/media/picture-url';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * Lớp bo góc viết SẴN thành chuỗi đầy đủ, không ghép động.
 *
 * Tailwind quét mã nguồn bằng cách tìm chuỗi ký tự; `` `rounded-${shape}` `` không bao giờ xuất
 * hiện nguyên vẹn trong tệp nên lớp đó không được sinh ra, và bo góc lặng lẽ mất tác dụng.
 */
const SHAPE = {
    full: 'rounded-full after:rounded-full',
    lg: 'rounded-lg after:rounded-lg',
} as const;

/**
 * Ô đổi ảnh, dùng chung cho ảnh đại diện và logo cơ sở.
 *
 * ─── Vì sao KHÔNG kiểm kích thước ở đây ──────────────────────────────────────
 *
 * Cùng lối với `DeleteResourceDialog`: trần kích thước là luật của server, chép sang client chỉ
 * tạo một bản sao sẽ lệch dần. Gửi lên rồi hiện nguyên văn lời từ chối — câu đó vốn được sinh ra
 * từ chính hằng số đang có hiệu lực, nên không bao giờ nói sai.
 *
 * `accept` bên dưới chỉ là tiện ích cho hộp chọn tệp, không phải chốt chặn.
 */
export function PictureField({
    endpoint,
    pictureKey,
    fallback,
    alt,
    rounded = 'full',
    layout = 'row',
    disabled = false,
}: {
    /** Đường dẫn nhận `PUT` và `DELETE`, ví dụ `/api/me/avatar`. */
    endpoint: string;
    pictureKey: string | null;
    /** Hiện khi chưa có ảnh: chữ tắt của tên, hoặc một biểu tượng. */
    fallback: ReactNode;
    alt: string;
    rounded?: 'full' | 'lg';
    /**
     * `row` cho hộp thoại, nơi có sẵn cả chiều ngang.
     *
     * `column` khi ô này đứng cạnh một tiêu đề: nút xuống dưới ảnh và bỏ dòng gợi ý định dạng,
     * nếu không cụm điều khiển sẽ chen ngang giữa ảnh và tên.
     */
    layout?: 'row' | 'column' | 'profile';
    /** Không có quyền sửa: vẫn thấy ảnh, không thấy nút. */
    disabled?: boolean;
}) {
    const router = useRouter();
    const fileInput = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function send(init: RequestInit) {
        setBusy(true);
        setError(null);

        try {
            const response = await fetch(endpoint, init);

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setError(body?.error?.message ?? 'Could not save this picture.');
                return;
            }

            // Khoá vừa đổi nằm ở cây Server Component — làm mới để ảnh mới hiện ra.
            router.refresh();
        } catch {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
            // Xoá để chọn LẠI ĐÚNG tệp vừa rồi vẫn bắn ra `change`. Không xoá thì lần thứ hai
            // trình duyệt coi là không có gì thay đổi và không báo gì cả.
            if (fileInput.current) fileInput.current.value = '';
        }
    }

    const column = layout === 'column';
    const profile = layout === 'profile';

    if (profile) {
        return (
            <div className="w-full max-w-64">
                <div className="group/picture bg-muted relative aspect-square overflow-hidden rounded-xl border">
                    <Avatar className="size-full rounded-xl after:rounded-xl">
                        <AvatarImage
                            src={pictureUrl(pictureKey)}
                            alt={alt}
                            className="rounded-xl object-cover"
                        />
                        <AvatarFallback className="rounded-xl text-4xl font-semibold">
                            {fallback}
                        </AvatarFallback>
                    </Avatar>

                    {!disabled && (
                        <div className="absolute top-3 left-3 z-10 flex translate-y-1 gap-1.5 opacity-0 transition-[opacity,transform] group-hover/picture:translate-y-0 group-hover/picture:opacity-100 group-focus-within/picture:translate-y-0 group-focus-within/picture:opacity-100">
                            <input
                                ref={fileInput}
                                type="file"
                                accept="image/png,image/jpeg,image/gif,image/webp"
                                className="sr-only"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) void send({ method: 'PUT', body: file });
                                }}
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="shadow-sm"
                                disabled={busy}
                                onClick={() => fileInput.current?.click()}
                            >
                                {busy ? (
                                    <Spinner />
                                ) : (
                                    <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                                )}
                                {pictureKey ? 'Replace' : 'Upload'}
                            </Button>
                            {pictureKey && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon-sm"
                                    className="bg-background shadow-sm hover:bg-destructive/15"
                                    aria-label="Remove profile picture"
                                    title="Remove picture"
                                    disabled={busy}
                                    onClick={() => void send({ method: 'DELETE' })}
                                >
                                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <p className="text-muted-foreground mt-3 text-xs leading-5">
                    Hover or focus the picture to replace it. PNG, JPEG, GIF or WebP.
                </p>
                {error && (
                    <p role="alert" className="text-destructive mt-2 text-sm">
                        {error}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div
            className={cn(
                'flex gap-4',
                column ? 'flex-col items-start gap-2' : 'flex-wrap items-center',
            )}
        >
            <Avatar className={cn('size-16', SHAPE[rounded])}>
                <AvatarImage src={pictureUrl(pictureKey)} alt={alt} className={SHAPE[rounded]} />
                <AvatarFallback className={cn('text-base', SHAPE[rounded])}>
                    {fallback}
                </AvatarFallback>
            </Avatar>

            {!disabled && (
                <div className="grid gap-2">
                    <div className="flex items-center gap-1">
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                // Gửi thẳng `File` làm thân request: nó là một `Blob`, nên `fetch`
                                // tự đặt `Content-Type` theo nó. Server vẫn nhận dạng lại bằng
                                // byte đầu tệp và không tin nhãn này.
                                if (file) void send({ method: 'PUT', body: file });
                            }}
                        />

                        <Button
                            type="button"
                            variant={column ? 'ghost' : 'outline'}
                            size="sm"
                            disabled={busy}
                            onClick={() => fileInput.current?.click()}
                        >
                            {busy ? (
                                <Spinner />
                            ) : (
                                <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                            )}
                            {pictureKey ? 'Replace' : 'Upload'}
                        </Button>

                        {pictureKey && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => void send({ method: 'DELETE' })}
                            >
                                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                Remove
                            </Button>
                        )}
                    </div>

                    {!column && (
                        <p className="text-muted-foreground text-xs">PNG, JPEG, GIF or WebP.</p>
                    )}
                </div>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
    );
}

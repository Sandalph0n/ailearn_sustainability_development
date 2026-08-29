'use client';

import { useState, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Alert02Icon,
    Cancel01Icon,
    Notification03Icon,
    UserSharingIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Một dòng trong bảng thông báo.
 *
 * Chưa có cơ chế nào SINH ra thông báo — không có bảng `Notification`, không có hàng đợi. Kiểu
 * này định nghĩa trước hình dạng để khi có nguồn thật thì chỉ việc đổ vào, không phải sửa giao
 * diện.
 */
export type AdminNotification = {
    id: string;
    icon: typeof Alert02Icon;
    title: string;
    body: string;
    /** Chuỗi đã định dạng sẵn ở server — `Date` không đi qua ranh giới server → client được. */
    at: string;
    tone: 'info' | 'attention';
};

/**
 * Khung hai cột: nội dung trang bên trái, bảng thông báo bên phải, thu gọn được.
 *
 * ─── Vì sao là component bọc, không phải một khối đặt cạnh ──────────────────
 *
 * Trạng thái đóng/mở nằm ở client, nhưng nó quyết định ĐỘ RỘNG của cột nội dung — thứ được dựng
 * ở server. Một Server Component không thể tự co lại theo state của hàng xóm.
 *
 * Nên component này cầm state và nhận nội dung qua `children`. Server dựng phần bên trong rồi
 * truyền vào như một `ReactNode` đã hoàn thiện; ranh giới client bọc bên ngoài mà không kéo theo
 * gì vào bundle.
 *
 * ─── Vì sao thu gọn thành một thanh dọc, không phải biến mất ────────────────
 *
 * Đóng hẳn thì không còn dấu vết nào để mở lại, và người dùng phải nhớ rằng có thứ đó tồn tại.
 * Một thanh hẹp với chiếc chuông giữ lại lối vào, và huy hiệu số vẫn đọc được khi đã thu.
 */
export function NotificationsPanel({
    children,
    notifications = [],
}: {
    children: ReactNode;
    notifications?: AdminNotification[];
}) {
    const [open, setOpen] = useState(true);
    const count = notifications.length;

    return (
        <div
            className={cn(
                'flex flex-col gap-6 lg:grid lg:items-start lg:gap-6',
                // Cột phải đổi độ rộng theo trạng thái. `minmax(0,1fr)` cho cột trái để nội dung
                // dài không đẩy lưới rộng ra — mặc định của grid là `auto`, và `auto` không co.
                open ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : 'lg:grid-cols-[minmax(0,1fr)_3rem]',
            )}
        >
            <div className="min-w-0">{children}</div>

            {/*
                `sticky top-6` để bảng theo mắt người dùng khi cuộn danh sách dài bên trái, thay
                vì trôi mất lên trên.
            */}
            <aside className="lg:sticky lg:top-6">
                {open ? (
                    <div className="bg-card overflow-hidden rounded-lg border">
                        <div className="flex items-center gap-2 border-b px-4 py-3">
                            <HugeiconsIcon
                                icon={Notification03Icon}
                                strokeWidth={2}
                                className="text-muted-foreground size-4"
                            />
                            <h2 className="flex-1 text-sm font-semibold">Notifications</h2>

                            {count > 0 && (
                                <span className="bg-muted rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums">
                                    {count}
                                </span>
                            )}

                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setOpen(false)}
                                aria-label="Collapse notifications"
                            >
                                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                            </Button>
                        </div>

                        {count === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                                <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                                    <HugeiconsIcon
                                        icon={Notification03Icon}
                                        strokeWidth={2}
                                        className="text-muted-foreground size-4"
                                    />
                                </div>
                                <p className="text-sm font-medium">Nothing to review</p>
                                <p className="text-muted-foreground text-sm">
                                    Join requests and anything else needing a decision will appear
                                    here.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-border divide-y">
                                {notifications.map((item) => (
                                    <li key={item.id} className="flex gap-3 px-4 py-3">
                                        <div
                                            className={cn(
                                                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                                                item.tone === 'attention'
                                                    ? 'bg-brand-amber/12 text-brand-amber'
                                                    : 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            <HugeiconsIcon
                                                icon={item.icon}
                                                strokeWidth={2}
                                                className="size-3.5"
                                            />
                                        </div>

                                        {/* `min-w-0` để tiêu đề dài xuống dòng thay vì đẩy vỡ cột. */}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{item.title}</p>
                                            <p className="text-muted-foreground text-sm">
                                                {item.body}
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-xs">
                                                {item.at}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    /* Thu gọn: thanh dọc hẹp, giữ lại lối mở và huy hiệu số. */
                    <div className="bg-card flex flex-row items-center gap-2 rounded-lg border p-1.5 lg:flex-col">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setOpen(true)}
                            aria-label="Expand notifications"
                        >
                            <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
                        </Button>

                        {count > 0 && (
                            <span className="bg-brand-amber/15 text-brand-amber rounded-sm px-1 text-xs font-semibold tabular-nums">
                                {count}
                            </span>
                        )}
                    </div>
                )}
            </aside>
        </div>
    );
}

/** Biểu tượng dùng cho thông báo về đơn xin vai trò. Xuất ra để trang server khỏi tự đoán. */
export const JOIN_REQUEST_ICON = UserSharingIcon;

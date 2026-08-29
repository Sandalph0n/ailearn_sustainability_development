'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowRight01Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons';

import { type InstitutionDeleteTarget } from '@/components/admin/institutions/delete-institution-dialog';
import { InstitutionFormDialog } from '@/components/admin/institutions/institution-form-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';

export type InstitutionListItem = InstitutionDeleteTarget & {
    website: string | null;
};

const column = columnHelperFor<InstitutionListItem>();

/**
 * Bảng danh sách cơ sở giáo dục, kèm các nút thao tác.
 *
 * ─── Vì sao chỉ phần này là Client Component ────────────────────────────────
 *
 * Trang bọc ngoài là Server Component và đọc thẳng database. Chỉ những gì cần tương tác — sắp
 * xếp, lọc, hộp thoại — mới cần chạy ở client, nên ranh giới đặt đúng ở đây. Dữ liệu đi qua một
 * lần dưới dạng props; client không tự gọi API để lấy danh sách.
 */
export function InstitutionsTable({ institutions }: { institutions: InstitutionListItem[] }) {
    /**
     * Định nghĩa cột nằm trong `useMemo` vì đây là mảng dựng mới mỗi lần render, mà bảng lại lấy
     * nó làm phụ thuộc — không ghi nhớ thì mỗi lần gõ vào ô tìm kiếm là dựng lại toàn bộ cột.
     */
    
    const columns = useMemo(
        () =>
            [
                column.accessor('name', {
                    header: 'Name',
                    // Tên là lối vào chính. Người ta bấm vào tên trước khi nghĩ tới menu ba chấm.
                    cell: (info) => (
                        <Link
                            href={`/admin/institutions/${info.row.original.id}`}
                            className="hover:text-primary font-medium hover:underline"
                        >
                            {info.getValue()}
                        </Link>
                    ),
                }),

                column.accessor('website', {
                    header: 'Website',
                    enableSorting: false,
                    cell: (info) => {
                        const website = info.getValue();
                        if (!website) {
                            return <span className="text-muted-foreground">—</span>;
                        }

                        return (
                            <a
                                href={website}
                                target="_blank"
                                // `noreferrer` đi kèm `noopener`: trang đích không cầm được tham
                                // chiếu `window.opener` để điều khiển tab này.
                                rel="noopener noreferrer"
                                className="text-primary inline-flex items-center gap-1 hover:underline"
                            >
                                {website.replace(/^https?:\/\//, '')}
                                <HugeiconsIcon
                                    icon={LinkSquare02Icon}
                                    strokeWidth={2}
                                    className="size-3.5"
                                />
                            </a>
                        );
                    },
                }),

                column.accessor((row) => row.counts.subjects, {
                    id: 'subjects',
                    header: 'Subjects',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.accessor((row) => row.counts.terms, {
                    id: 'terms',
                    header: 'Terms',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.display({
                    id: 'actions',
                    header: '',
                    cell: (info) => <OpenSetupLink id={info.row.original.id} />,
                }),
            ] as Array<AdminColumnDef<InstitutionListItem>>,
        [],
    );

    return (
        <DataTable
            columns={columns}
            data={institutions}
            filterColumnId="name"
            filterPlaceholder="Search institutions…"
            emptyMessage="No institutions yet. Create the first one."
            toolbar={
                <InstitutionFormDialog
                    trigger={
                        <Button>
                            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                            New institution
                        </Button>
                    }
                />
            }
        />
    );
}

/**
 * Lối vào trang cài đặt của một cơ sở.
 *
 * Là một LIÊN KẾT chứ không phải nút mở menu: nó chuyển trang, và mũi tên nói đúng điều đó. Ba
 * chấm nghĩa là "còn tuỳ chọn khác", đặt ở đây sẽ hứa một thứ không có.
 *
 * Tên ở cột đầu cũng trỏ tới cùng chỗ này. Hai lối vào cho cùng một đích là cố ý — mắt tìm tên
 * trước, còn chuột quen bấm ở cuối hàng.
 */
function OpenSetupLink({ id }: { id: string }) {
    return (
        <div className="flex justify-end">
            <Link
                href={`/admin/institutions/${id}`}
                aria-label="Open setup"
                className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            >
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Link>
        </div>
    );
}

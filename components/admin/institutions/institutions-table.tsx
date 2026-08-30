'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Add01Icon,
    ArrowRight01Icon,
    Delete02Icon,
    Edit02Icon,
    LinkSquare02Icon,
    MoreVerticalIcon,
} from '@hugeicons/core-free-icons';

import { useListQuery } from '@/components/admin/use-list-query';
import { Input } from '@/components/ui/input';

import {
    DeleteInstitutionDialog,
    type InstitutionDeleteTarget,
} from '@/components/admin/institutions/delete-institution-dialog';
import { InstitutionFormDialog } from '@/components/admin/institutions/institution-form-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
export function InstitutionsTable({
    institutions,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    institutions: InstitutionListItem[];
    page: number;
    pageCount: number;
    total: number;
    sort: string;
    dir: 'asc' | 'desc';
    /** Từ khoá hiện tại trên URL. Ô nhập tự giữ giá trị riêng, xem `useListQuery`. */
    query: string;
}) {
    const list = useListQuery();
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
                    cell: (info) => <InstitutionActions institution={info.row.original} />,
                }),
            ] as Array<AdminColumnDef<InstitutionListItem>>,
        [],
    );

    return (
        <DataTable
            columns={columns}
            data={institutions}
            emptyMessage={
                // Ba ca rỗng khác nhau, và nói nhầm ca thì người dùng đi tìm sai chỗ:
                // hết kết quả tìm kiếm, quá số trang, hay thật sự chưa có gì.
                list.input
                    ? `No institutions match "${list.input}".`
                    : page > 1
                      ? `Page ${page} is past the end. There ${total === 1 ? 'is' : 'are'} only ${total}.`
                      : 'No institutions yet. Create the first one.'
            }
            toolbar={
                <>
                    {/*
                        Ô tìm kiếm nằm NGOÀI `DataTable` ở chế độ server: nó ghi vào URL chứ không
                        đổi state của bảng, nên nó thuộc về nơi biết đường dẫn — chính là đây.
                    */}
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search institutions…"
                        className="max-w-xs"
                        aria-label="Search institutions"
                    />

                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>

                    <div className="flex-1" />

                    <InstitutionFormDialog
                        trigger={
                            <Button>
                                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                                New institution
                            </Button>
                        }
                    />
                </>
            }
            server={{
                page,
                pageCount,
                sort,
                dir,
                pending: list.isPending,
                // Bấm lại đúng cột đang sắp thì đảo chiều; bấm cột khác thì bắt đầu từ tăng dần.
                onSort: (columnId) =>
                    list.setParams({
                        sort: columnId,
                        dir: sort === columnId && dir === 'asc' ? 'desc' : 'asc',
                        page: null,
                    }),
                onPage: (next) => list.setParams({ page: next === 1 ? null : next }),
            }}
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

function InstitutionActions({ institution }: { institution: InstitutionListItem }) {
    return (
        <div className="flex justify-end gap-1">
            <OpenSetupLink id={institution.id} />
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button variant="ghost" size="icon-sm" aria-label="Open actions">
                            <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                        </Button>
                    }
                />
                <DropdownMenuContent align="end">
                    <InstitutionFormDialog
                        institution={institution}
                        trigger={
                            <DropdownMenuItem closeOnClick={false}>
                                <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                                Edit details
                            </DropdownMenuItem>
                        }
                    />
                    <DropdownMenuSeparator />
                    <DeleteInstitutionDialog
                        institution={institution}
                        trigger={
                            <DropdownMenuItem variant="destructive" closeOnClick={false}>
                                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                                Delete
                            </DropdownMenuItem>
                        }
                    />
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

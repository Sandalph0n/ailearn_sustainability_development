'use client';

import { useState, type ReactNode } from 'react';
import {
    columnFilteringFeature,
    createColumnHelper,
    createCoreRowModel,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    filterFns,
    rowPaginationFeature,
    rowSortingFeature,
    sortFns,
    tableFeatures,
    useTable,
    type ColumnDef,
    type RowData,
    type TableFeatures,
} from '@tanstack/react-table';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowDown01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    ArrowUp01Icon,
    ArrowUpDownIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

/**
 * Bảng dữ liệu dùng chung cho khu quản trị: sắp xếp, lọc theo từ khoá, phân trang.
 *
 * ─── Vì sao là một component thay vì chép lại ở mỗi trang ────────────────────
 *
 * Mọi trang quản trị đều cần đúng ba thứ này. shadcn không phát hành `DataTable` như một
 * component — tài liệu của họ đưa ra một công thức để chép. Chép sáu lần thì sáu bản sẽ lệch
 * nhau, nên gói lại một lần ở đây.
 *
 * ─── Lưu ý về phiên bản ──────────────────────────────────────────────────────
 *
 * Đây là TanStack Table **v9**, khác hẳn v8 mà gần như mọi hướng dẫn trên mạng đang viết:
 *
 *     v8                          v9
 *     useReactTable(...)          useTable(...)
 *     getCoreRowModel()           createCoreRowModel(features)
 *     bật ngầm mọi tính năng      phải khai báo qua `tableFeatures({...})`
 *
 * Việc phải khai báo tính năng là cố ý — thứ không khai thì không lọt vào bundle.
 */
const FEATURES = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowPaginationFeature,

    // v9 gói cả row model lẫn registry hàm xử lý VÀO CHÍNH object tính năng, chứ không nhận
    // chúng như tuỳ chọn riêng của bảng như v8.
    coreRowModel: createCoreRowModel(),
    sortedRowModel: createSortedRowModel(),
    filteredRowModel: createFilteredRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    sortFns,
    filterFns,
});

/** Tiện ích dựng cột, đã gắn sẵn bộ tính năng ở trên. Trang gọi tới để khai báo cột. */
export function columnHelperFor<TData extends RowData>() {
    return createColumnHelper<typeof FEATURES, TData>();
}

export type AdminColumnDef<TData extends RowData> = ColumnDef<typeof FEATURES, TData, unknown>;

export function DataTable<TData extends RowData>({
    columns,
    data,
    /** Cột mà ô tìm kiếm sẽ lọc theo. Bỏ trống thì không hiện ô tìm kiếm. */
    filterColumnId,
    filterPlaceholder = 'Search…',
    emptyMessage = 'Nothing here yet.',
    toolbar,
    pageSize = 10,
}: {
    columns: Array<AdminColumnDef<TData>>;
    data: TData[];
    filterColumnId?: string;
    filterPlaceholder?: string;
    emptyMessage?: ReactNode;
    /** Nút bấm đặt bên phải ô tìm kiếm — thường là "New …". */
    toolbar?: ReactNode;
    pageSize?: number;
}) {
    const [filter, setFilter] = useState('');

    const table = useTable({
        features: FEATURES,
        // Ép kiểu CHỈ ở đây, và chỉ vì suy diễn generic của v9 nới `TData` thành `RowData` khi
        // gọi từ trong một hàm generic. Cột do phía gọi khai báo vẫn giữ kiểu chặt của chúng —
        // `AdminColumnDef<TData>` ở prop bên trên là thứ người dùng component nhìn thấy.
        columns: columns as unknown as Array<ColumnDef<TableFeatures, RowData, unknown>>,
        data: data as RowData[],
        initialState: { pagination: { pageIndex: 0, pageSize } },
    });

    const rows = table.getRowModel().rows;
    const pageCount = table.getPageCount();

    return (
        <div className="flex flex-col gap-4">
            {(filterColumnId || toolbar) && (
                <div className="flex items-center gap-2">
                    {filterColumnId && (
                        <Input
                            value={filter}
                            onChange={(event) => {
                                const next = event.target.value;
                                setFilter(next);
                                table.getColumn(filterColumnId)?.setFilterValue(next);
                                // Lọc xong mà còn ở trang 5 thì thấy bảng trống dù có kết quả.
                                table.setPageIndex(0);
                            }}
                            placeholder={filterPlaceholder}
                            className="max-w-xs"
                        />
                    )}
                    <div className="flex-1" />
                    {toolbar}
                </div>
            )}

            <div className="overflow-hidden rounded-xl border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const sortable = header.column.getCanSort();
                                    const sorted = header.column.getIsSorted();

                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder ? null : sortable ? (
                                                <button
                                                    type="button"
                                                    onClick={header.column.getToggleSortingHandler()}
                                                    className="hover:text-foreground -ml-2 inline-flex items-center gap-1 rounded px-2 py-1 transition-colors"
                                                >
                                                    <table.FlexRender header={header} />
                                                    <HugeiconsIcon
                                                        icon={
                                                            sorted === 'asc'
                                                                ? ArrowUp01Icon
                                                                : sorted === 'desc'
                                                                  ? ArrowDown01Icon
                                                                  : ArrowUpDownIcon
                                                        }
                                                        strokeWidth={2}
                                                        className="size-3.5 opacity-60"
                                                    />
                                                </button>
                                            ) : (
                                                <table.FlexRender header={header} />
                                            )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>

                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="text-muted-foreground h-28 text-center"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow key={row.id}>
                                    {/*
                                        `getAllCells` chứ không phải `getVisibleCells`: cái sau
                                        thuộc `columnVisibilityFeature`, mà bảng này không bật
                                        tính năng ẩn/hiện cột. v9 không tự thêm phương thức của
                                        tính năng chưa khai — gọi vào là lỗi lúc chạy.
                                    */}
                                    {row.getAllCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            <table.FlexRender cell={cell} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Ẩn hẳn thanh phân trang khi chỉ có một trang — đỡ một hàng nút bấm vô dụng. */}
            {pageCount > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm tabular-nums">
                        Page {table.state.pagination.pageIndex + 1} of {pageCount}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Next
                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

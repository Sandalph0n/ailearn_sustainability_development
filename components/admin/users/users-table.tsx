'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Shield01Icon } from '@hugeicons/core-free-icons';

import { useListQuery } from '@/components/admin/use-list-query';
import { Badge } from '@/components/ui/badge';
import { DataTable, columnHelperFor, type AdminColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export type UserListItem = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isSystemAdmin: boolean;
    /** Ngày tạo, đã định dạng ở server. */
    joined: string;
    counts: { roles: number; attempts: number };
};

const column = columnHelperFor<UserListItem>();

export function UsersTable({
    users,
    currentUserId,
    page,
    pageCount,
    total,
    sort,
    dir,
}: {
    users: UserListItem[];
    /** Người đang đăng nhập — không được tự gỡ quyền của chính mình. */
    currentUserId: string;
    page: number;
    pageCount: number;
    total: number;
    sort: string;
    dir: 'asc' | 'desc';
}) {
    const list = useListQuery();

    const columns = useMemo(
        () =>
            [
                column.accessor('lastName', {
                    header: 'Name',
                    cell: (info) => (
                        <div className="flex flex-col">
                            <span className="font-medium">
                                {info.row.original.firstName} {info.row.original.lastName}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {info.row.original.email}
                            </span>
                        </div>
                    ),
                }),

                column.accessor((row) => row.counts.roles, {
                    id: 'roles',
                    header: 'Active roles',
                    enableSorting: false,
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.accessor((row) => row.counts.attempts, {
                    id: 'attempts',
                    header: 'Attempts',
                    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
                }),

                column.accessor('joined', {
                    id: 'createdAt',
                    header: 'Joined',
                    cell: (info) => (
                        <span className="text-muted-foreground text-sm">{info.getValue()}</span>
                    ),
                }),

                column.accessor('isSystemAdmin', {
                    header: 'Admin',
                    cell: (info) => (
                        <AdminToggle user={info.row.original} currentUserId={currentUserId} />
                    ),
                }),
            ] as Array<AdminColumnDef<UserListItem>>,
        [currentUserId],
    );

    return (
        <DataTable
            columns={columns}
            data={users}
            emptyMessage={
                list.input
                    ? `No accounts match "${list.input}".`
                    : page > 1
                      ? `Page ${page} is past the end. There ${total === 1 ? 'is' : 'are'} only ${total}.`
                      : 'No accounts yet.'
            }
            toolbar={
                <>
                    <Input
                        value={list.input}
                        onChange={(event) => list.setInput(event.target.value)}
                        placeholder="Search by name or email…"
                        className="max-w-xs"
                        aria-label="Search accounts"
                    />
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {total} total
                    </span>
                    <div className="flex-1" />
                    {/*
                        Không có nút "New user": tài khoản do chính người dùng tạo qua đăng ký.
                        Quản trị viên cấp quyền, không tạo danh tính hộ người khác.
                    */}
                    <Badge variant="secondary">Accounts are created by signing up</Badge>
                </>
            }
            server={{
                page,
                pageCount,
                sort,
                dir,
                pending: list.isPending,
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
 * Công tắc quyền quản trị toàn hệ thống.
 *
 * ─── Vì sao đổi ngay tại chỗ, không qua hộp thoại ───────────────────────────
 *
 * Nó là một giá trị nhị phân, đảo lại được ngay nếu bấm nhầm. Bắt mở hộp thoại xác nhận cho một
 * thao tác như vậy là thêm hai cú bấm cho mọi lần dùng để phòng một lần lỡ tay.
 *
 * Ca thật sự nguy hiểm — tự gỡ quyền của chính mình — thì đã chặn cứng ở server, và công tắc ở
 * đây cũng vô hiệu hoá luôn.
 */
function AdminToggle({ user, currentUserId }: { user: UserListItem; currentUserId: string }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isSelf = user.id === currentUserId;

    async function toggle(next: boolean) {
        setSaving(true);
        setError(null);

        try {
            const response = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isSystemAdmin: next }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setError(body?.error?.message ?? 'Could not change this.');
                setSaving(false);
                return;
            }
        } catch {
            setError('Cannot reach the server.');
            setSaving(false);
            return;
        }

        setSaving(false);
        router.refresh();
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Switch
                    checked={user.isSystemAdmin}
                    disabled={saving || isSelf}
                    onCheckedChange={(next) => void toggle(next)}
                    aria-label={`System admin for ${user.email}`}
                />
                {user.isSystemAdmin && (
                    <HugeiconsIcon
                        icon={Shield01Icon}
                        strokeWidth={2}
                        className="text-brand-teal size-4"
                    />
                )}
            </div>

            {isSelf && <span className="text-muted-foreground text-xs">You</span>}
            {error && <span className="text-destructive text-xs">{error}</span>}
        </div>
    );
}

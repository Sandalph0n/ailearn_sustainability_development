'use client';

import Link from 'next/link';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Logout01Icon,
    UserIcon,
    Settings01Icon,
    ArrowDown01Icon,
} from '@hugeicons/core-free-icons';

import { pictureUrl } from '@/components/media/picture-url';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AccountUser = {
    firstName: string;
    lastName: string;
    email: string;
    /** Khoá ảnh đại diện trong bucket `media`, `null` khi chưa đặt. */
    avatarKey: string | null;
};

type Props = {
    user: AccountUser;
    /** Bấm "Sign out". Phần gọi API do nơi dùng cung cấp — component này không tự làm gì. */
    onSignOut?: () => void;
};

/**
 * Box tài khoản ở góc phải header.
 *
 * Thuần trình bày: nhận `user` qua props, không tự đọc phiên đăng nhập, không tự gọi API. Nhờ vậy
 * dùng lại được ở bất kỳ đâu và thử được mà không cần database.
 *
 * Trên màn hình hẹp chỉ còn avatar — tên và email ẩn đi để không chiếm chỗ của header.
 */
export function AccountBox({ user, onSignOut }: Props) {
    const initials = `${user.firstName.at(0) ?? ''}${user.lastName.at(0) ?? ''}`.toUpperCase();
    const fullName = `${user.firstName} ${user.lastName}`.trim();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring hover:cursor-pointer">
                <Avatar className="size-7">
                    <AvatarImage src={pictureUrl(user.avatarKey)} alt="" />
                    <AvatarFallback className="text-xs">{initials || '?'}</AvatarFallback>
                </Avatar>

                <div className="hidden text-left leading-tight sm:grid">
                    <span className="truncate text-sm font-medium">{fullName}</span>
                    <span className="text-muted-foreground max-w-40 truncate text-xs">
                        {user.email}
                    </span>
                </div>

                <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    strokeWidth={2}
                    className="text-muted-foreground hidden size-4 sm:block"
                />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
                {/*
                    `DropdownMenuLabel` dựng ra `Menu.GroupLabel`, và Base UI BẮT BUỘC nó nằm
                    trong một `Menu.Group` — thiếu thì ném lỗi "MenuGroupContext is missing".

                    Ràng buộc đó có lý do: nhãn phải gán tên cho một nhóm cụ thể thì trình đọc
                    màn hình mới nói được "Profile, trong nhóm Nguyên Phạm". Nhãn đứng trơ một
                    mình chỉ là chữ, không nối với gì cả.
                */}
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                        <span className="font-medium">{fullName}</span>
                        <span className="text-muted-foreground truncate text-xs font-normal">
                            {user.email}
                        </span>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem render={<Link href="/navigation/profile" />}>
                        <HugeiconsIcon icon={UserIcon} strokeWidth={2} />
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/navigation/settings" />}>
                        <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                        Settings
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem variant="destructive" onClick={onSignOut}>
                    <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

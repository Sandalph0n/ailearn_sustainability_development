'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Image01Icon } from '@hugeicons/core-free-icons';

import { PictureField } from '@/components/media/picture-field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

/**
 * Hộp thoại đổi ảnh đại diện, mở từ trình đơn tài khoản.
 *
 * ─── Vì sao là hộp thoại chứ không phải một trang hồ sơ ─────────────────────
 *
 * Đổi ảnh là một thao tác đơn lẻ, không cần rời khỏi trang đang làm. Trang hồ sơ sẽ cần khi có
 * thêm thứ để sửa — đổi tên, đổi mật khẩu — và lúc đó `PictureField` chuyển sang đó nguyên vẹn.
 */
export function AvatarDialog({
    initials,
    avatarKey,
}: {
    initials: string;
    avatarKey: string | null;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    // `closeOnClick={false}`: trình đơn đóng lại ngay khi bấm sẽ tháo luôn hộp
                    // thoại vừa mở, vì hộp thoại là con của mục này.
                    <DropdownMenuItem closeOnClick={false}>
                        <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                        Change picture
                    </DropdownMenuItem>
                }
            />

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Profile picture</DialogTitle>
                    <DialogDescription>
                        Shown next to your name across the platform.
                    </DialogDescription>
                </DialogHeader>

                <PictureField
                    endpoint="/api/me/avatar"
                    pictureKey={avatarKey}
                    fallback={initials || '?'}
                    alt="Your profile picture"
                />

                <DialogFooter>
                    <DialogClose render={<Button variant="outline">Done</Button>} />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

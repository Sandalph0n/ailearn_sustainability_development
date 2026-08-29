import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    Shield01Icon,
    ToolboxIcon,
    UniversityIcon,
    UserMultipleIcon,
} from '@hugeicons/core-free-icons';

import { db } from '@/lib/db';

/**
 * Các lối vào của khu quản trị.
 *
 * ─── Vì sao là DANH SÁCH chứ không phải lưới thẻ ─────────────────────────────
 *
 * Bản trước là một lưới sáu thẻ, mỗi thẻ một biểu tượng, một tiêu đề, một câu mô tả. Đó đúng
 * khuôn trang giới thiệu sản phẩm — và cũng đúng khuôn mà giao diện máy sinh hay rơi vào.
 *
 * Nhưng đây là bảng quản trị, không phải trang bán hàng. Người vào đây đã biết mình cần gì; thứ
 * họ muốn là ĐI TỚI nhanh và thấy hệ thống đang có bao nhiêu. Danh sách dày làm cả hai việc đó
 * tốt hơn: sáu dòng đọc hết trong một lần liếc, còn sáu thẻ thì mắt phải nhảy theo hai chiều.
 *
 * Nó cũng tách hẳn khu quản trị khỏi ngôn ngữ của trang giới thiệu — hai nơi phục vụ hai kiểu
 * người đọc, không có lý do gì phải trông giống nhau.
 */
export const dynamic = 'force-dynamic';

const SECTIONS = [
    {
        href: '/admin/institutions',
        icon: UniversityIcon,
        title: 'Institutions',
        description: 'Schools and universities using the platform.',
        count: () => db.institution.count(),
    },
    {
        href: '/admin/subjects',
        icon: BookOpen01Icon,
        title: 'Subjects',
        description: 'Units offered, and which term they run in.',
        count: () => db.subject.count(),
    },
    {
        href: '/admin/terms',
        icon: Calendar03Icon,
        title: 'Terms',
        description: 'Study periods and their teaching weeks.',
        count: () => db.studyTerm.count(),
    },
    {
        href: '/admin/tools',
        icon: ToolboxIcon,
        title: 'Tools',
        description: 'Tools an assessment can hand to students.',
        count: () => db.tool.count(),
    },
    {
        href: '/admin/users',
        icon: UserMultipleIcon,
        title: 'Users',
        description: 'Accounts, and what they can reach.',
        count: () => db.user.count(),
    },
    {
        href: '/admin/roles',
        icon: Shield01Icon,
        title: 'Roles',
        description: 'Role definitions and the permissions behind them.',
        count: () => db.role.count(),
    },
] as const;

export default async function AdminOverviewPage() {
    // Chạy song song: sáu phép đếm độc lập, xếp tuần tự thì tổng thời gian là tổng của cả sáu.
    const counts = await Promise.all(SECTIONS.map((section) => section.count()));

    return (
        <div className="flex max-w-4xl flex-col gap-6 pt-1">
            <section className="flex flex-col gap-1.5">
                <h1 className="font-heading text-xl font-semibold tracking-tight">
                    Administration
                </h1>
                <p className="text-muted-foreground text-sm">
                    Platform-wide settings. Changes here affect every institution, so they are kept
                    apart from the rest of the app.
                </p>
            </section>

            {/*
                `divide-y` thay cho khoảng cách giữa các thẻ: một đường kẻ mảnh nói "đây là các
                mục cùng loại" rõ hơn sáu hộp rời nhau, và tiết kiệm chiều dọc.
            */}
            <section className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
                {SECTIONS.map((section, index) => (
                    <Link
                        key={section.href}
                        href={section.href}
                        className="hover:bg-muted/50 group flex items-center gap-4 px-4 py-3.5 transition-colors"
                    >
                        <div className="bg-muted text-muted-foreground group-hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md transition-colors">
                            <HugeiconsIcon icon={section.icon} strokeWidth={2} className="size-4" />
                        </div>

                        {/* `min-w-0` để mô tả dài bị cắt bằng dấu ba chấm thay vì đẩy vỡ hàng. */}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{section.title}</p>
                            <p className="text-muted-foreground truncate text-sm">
                                {section.description}
                            </p>
                        </div>

                        {/*
                            Số đếm dùng `tabular-nums` — đây là một CỘT số, và chữ số đều bề rộng
                            giúp chúng thẳng hàng dọc qua sáu dòng.
                        */}
                        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                            {counts[index]}
                        </span>

                        <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            strokeWidth={2}
                            className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
                        />
                    </Link>
                ))}
            </section>
        </div>
    );
}

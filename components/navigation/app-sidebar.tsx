'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Home01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    TaskDone01Icon,
    StudentIcon,
} from '@hugeicons/core-free-icons';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';

/**
 * Danh sách mục điều hướng.
 *
 * Để thành DỮ LIỆU chứ không phải một dãy JSX viết tay: nơi hiển thị chỉ việc lặp qua nó. Thêm
 * một mục là thêm một dòng, không phải chép lại năm dòng JSX rồi sửa.
 */
const NAV_ITEMS = [
    { href: '/navigation/dashboard', label: 'Dashboard', icon: Home01Icon },
    { href: '/navigation/subjects', label: 'Subjects', icon: BookOpen01Icon },
    { href: '/navigation/assessments', label: 'Assessments', icon: TaskDone01Icon },
    { href: '/navigation/calendar', label: 'Calendar', icon: Calendar03Icon },
] as const;

export function AppSidebar() {
    const pathname = usePathname();

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" render={pathname != "/" ? <Link href="/"/>: <div/>}>
                            <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                <HugeiconsIcon icon={StudentIcon} strokeWidth={2} className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left leading-tight">
                                <span className="font-heading truncate font-medium">AI-Learn</span>
                                <span className="text-muted-foreground truncate text-xs">
                                    Learning platform
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {NAV_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        // Khớp chính xác với `/`, còn lại khớp theo tiền tố — nếu không thì
                                        // trang chủ luôn sáng vì mọi đường dẫn đều bắt đầu bằng `/`.
                                        isActive={pathname.startsWith(item.href)}
                                        tooltip={item.label}
                                        render={<Link href={item.href} />}
                                    >
                                        <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                {/* Khu vực tài khoản sẽ đặt ở đây khi có đăng nhập. */}
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

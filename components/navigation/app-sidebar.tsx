'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    BookOpen01Icon,
    Calendar03Icon,
    Home01Icon,
    SourceCodeIcon,
    TaskDone01Icon,
    WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons';

import { BrandLogo } from '@/components/brand-logo';
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
 * Mục điều hướng, để thành DỮ LIỆU — thêm một mục là thêm một dòng.
 *
 * Chia hai nhóm vì hai loại việc khác nhau: một bên là xem và theo dõi, một bên là ngồi xuống
 * làm. Gộp chung thì danh sách dài dần rồi không ai tìm thấy gì.
 */
const STUDY_ITEMS = [
    { href: '/navigation/dashboard', label: 'Dashboard', icon: Home01Icon },
    { href: '/navigation/subjects', label: 'Subjects', icon: BookOpen01Icon },
    { href: '/navigation/assessments', label: 'Assessments', icon: TaskDone01Icon },
    { href: '/navigation/calendar', label: 'Calendar', icon: Calendar03Icon },
] as const;

const TOOL_ITEMS = [
    { href: '/tools/code', label: 'Code', icon: SourceCodeIcon },
    { href: '/tools/diagram', label: 'Diagram', icon: WorkflowSquare01Icon },
] as const;

/**
 * Mục đang mở phải nổi hơn mục đang rê chuột.
 *
 * Mặc định của shadcn dùng CÙNG một token `--sidebar-accent` cho cả `hover` lẫn `data-active`,
 * nên trên nền teal đậm hai trạng thái trông y hệt nhau và không biết mình đang ở đâu. Đè lại ở
 * đây — chỗ dùng — thay vì sửa `components/ui/sidebar.tsx`.
 */
const ACTIVE_ITEM =
    'data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:shadow-sm data-active:hover:bg-sidebar-primary data-active:hover:text-sidebar-primary-foreground';

export function AppSidebar() {
    const pathname = usePathname();

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            render={<Link href="/" />}
                            className="hover:bg-sidebar-accent/60"
                        >
                            <BrandLogo className="size-8 shrink-0" gradientId="ailearn-mark-nav" />
                            <div className="grid flex-1 text-left leading-tight">
                                <span className="font-heading truncate font-semibold">
                                    AI-Learn
                                </span>
                                <span className="text-sidebar-foreground/60 truncate text-xs">
                                    Learning platform
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-sidebar-foreground/50">
                        Study
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {STUDY_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        isActive={pathname.startsWith(item.href)}
                                        tooltip={item.label}
                                        render={<Link href={item.href} />}
                                        className={ACTIVE_ITEM}
                                    >
                                        <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel className="text-sidebar-foreground/50">
                        Tools
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {TOOL_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        isActive={pathname.startsWith(item.href)}
                                        tooltip={item.label}
                                        render={<Link href={item.href} />}
                                        className={ACTIVE_ITEM}
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
                {/*
                    Câu định vị, đặt ở chân sidebar. Nó biến mất khi thu gọn — `group-data`
                    của Sidebar bật `collapsible=icon`, lúc đó chỉ còn chỗ cho biểu tượng.
                */}
                <p className="text-sidebar-foreground/45 px-3 py-2 text-xs leading-relaxed group-data-[collapsible=icon]:hidden">
                    Every session is recorded, and plays back from the start.
                </p>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

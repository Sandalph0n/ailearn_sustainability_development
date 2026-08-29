'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Home01Icon,
    UniversityIcon,
    BookOpen01Icon,
    Calendar03Icon,
    UserMultipleIcon,
    Shield01Icon,
    ToolboxIcon,
    ArrowLeft01Icon,
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
 * Mục điều hướng của khu quản trị, để thành DỮ LIỆU giống `AppSidebar` — thêm một mục là thêm
 * một dòng.
 *
 * Chia nhóm vì hai loại việc khác hẳn nhau: một bên là dữ liệu học vụ (ai dạy môn gì, kỳ nào),
 * một bên là quyền hạn. Gộp chung thì danh sách dài dần rồi không ai tìm thấy gì.
 */
const CATALOGUE_ITEMS = [
    { href: '/admin/institutions', label: 'Institutions', icon: UniversityIcon },
    { href: '/admin/subjects', label: 'Subjects', icon: BookOpen01Icon },
    { href: '/admin/terms', label: 'Terms', icon: Calendar03Icon },
    { href: '/admin/tools', label: 'Tools', icon: ToolboxIcon },
] as const;

const ACCESS_ITEMS = [
    { href: '/admin/users', label: 'Users', icon: UserMultipleIcon },
    { href: '/admin/roles', label: 'Roles', icon: Shield01Icon },
] as const;

/**
 * Mục đang mở phải nổi hơn mục đang rê chuột.
 *
 * shadcn dùng cùng token `--sidebar-accent` cho cả `hover` lẫn `data-active`, nên trên nền teal
 * đậm hai trạng thái trông y hệt nhau. Đè lại ở chỗ dùng, không sửa `components/ui/sidebar.tsx`.
 */
const ACTIVE_ITEM =
    'data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:shadow-sm data-active:hover:bg-sidebar-primary data-active:hover:text-sidebar-primary-foreground';

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            render={<Link href="/admin" />}
                            className="hover:bg-sidebar-accent/60"
                        >
                            <div className="bg-destructive text-destructive-foreground flex aspect-square size-8 items-center justify-center rounded-xl">
                                <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left leading-tight">
                                <span className="font-heading truncate font-medium">AI-Learn</span>
                                <span className="text-sidebar-foreground/60 truncate text-xs">
                                    Administration
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-sidebar-foreground/50">Overview</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    // Khớp CHÍNH XÁC, không theo tiền tố: `/admin` là tiền tố của mọi
                                    // đường dẫn khác trong khu này nên nó sẽ luôn sáng.
                                    isActive={pathname === '/admin'}
                                    tooltip="Overview"
                                    render={<Link href="/admin" />}
                                    className={ACTIVE_ITEM}
                                >
                                    <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
                                    <span>Overview</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel className="text-sidebar-foreground/50">Catalogue</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {CATALOGUE_ITEMS.map((item) => (
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
                    <SidebarGroupLabel className="text-sidebar-foreground/50">Access</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {ACCESS_ITEMS.map((item) => (
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
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Back to app"
                            render={<Link href="/navigation/dashboard" />}
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                            <span>Back to app</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

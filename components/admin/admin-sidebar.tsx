'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Home01Icon,
    UniversityIcon,
    UserMultipleIcon,
    Shield01Icon,
    Key01Icon,
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
 * Chỉ đặt ở đây những tài nguyên có nghĩa trên TOÀN nền tảng. Subject và term thuộc về một cơ
 * sở cụ thể, nên lối vào của chúng nằm trong trang institution thay vì xuất hiện ở cấp này.
 */
const PLATFORM_ITEMS = [
    { href: '/admin/institutions', label: 'Institutions', icon: UniversityIcon },
    { href: '/admin/tools', label: 'Tools', icon: ToolboxIcon },
] as const;

const ACCESS_ITEMS = [
    { href: '/admin/users', label: 'Users', icon: UserMultipleIcon },
    { href: '/admin/roles', label: 'Roles', icon: Shield01Icon },
    { href: '/admin/permissions', label: 'Permissions', icon: Key01Icon },
] as const;

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
                            <div className="bg-destructive text-destructive-foreground flex aspect-square size-8 items-center justify-center rounded-xl">
                                <HugeiconsIcon
                                    icon={Shield01Icon}
                                    strokeWidth={2}
                                    className="size-4"
                                />
                            </div>
                            <div className="grid flex-1 text-left leading-tight">
                                <span className="font-heading truncate font-medium">AI-Learn</span>
                                <span className="text-muted-foreground truncate text-xs">
                                    Administration
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Overview</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    // Khớp CHÍNH XÁC, không theo tiền tố: `/admin` là tiền tố của mọi
                                    // đường dẫn khác trong khu này nên nó sẽ luôn sáng.
                                    isActive={pathname === '/admin'}
                                    tooltip="Overview"
                                    render={<Link href="/admin" />}
                                >
                                    <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
                                    <span>Overview</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>Platform</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {PLATFORM_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
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

                <SidebarGroup>
                    <SidebarGroupLabel>Access</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {ACCESS_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
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

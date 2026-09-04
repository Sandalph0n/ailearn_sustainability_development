'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    BookOpen01Icon,
    Calendar03Icon,
    Home01Icon,
    Shield01Icon,
    SourceCodeIcon,
    TaskDone01Icon,
    UniversityIcon,
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
import {
    CONTEXT_PARAM,
    type AuthorizedContextOption,
} from '@/lib/context/context-params';
import { hasAnyPermission, PERMISSION_CODE } from '@/lib/auth/permissions';

/**
 * Mục điều hướng, để thành DỮ LIỆU — thêm một mục là thêm một dòng.
 *
 * Chia hai nhóm vì hai loại việc khác nhau: một bên là xem và theo dõi, một bên là ngồi xuống
 * làm. Gộp chung thì danh sách dài dần rồi không ai tìm thấy gì.
 */
const PERSONAL_ITEMS = [
    { href: '/navigation/dashboard', label: 'Dashboard', icon: Home01Icon },
    {
        href: '/navigation/assessments',
        label: 'Assessments',
        icon: TaskDone01Icon,
    },
    { href: '/navigation/calendar', label: 'Calendar', icon: Calendar03Icon },
] as const;

const ACCESS_CONTROL_ITEMS = [
    { href: '/navigation/roles', label: 'Role Management', icon: Shield01Icon },
    { href: '/navigation/subject-access', label: 'Subject Access', icon: BookOpen01Icon },
] as const;

const INSTITUTION_ITEMS = [
    {
        href: '/navigation/institution/subjects',
        label: 'Subjects',
        icon: UniversityIcon,
        permissions: [
            PERMISSION_CODE.SUBJECT_CREATE,
            PERMISSION_CODE.SUBJECT_VIEW,
            PERMISSION_CODE.SUBJECT_UPDATE,
            PERMISSION_CODE.SUBJECT_DELETE,
        ],
    },
] as const;

const TOOL_ITEMS = [
    { href: '/tools/code', label: 'Code', icon: SourceCodeIcon },
    { href: '/tools/diagram', label: 'Diagram', icon: WorkflowSquare01Icon },
] as const;

export function AppSidebar({ contexts }: { contexts: AuthorizedContextOption[] }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const wantedInstitution = searchParams.get(CONTEXT_PARAM.institution);
    const wantedRole = searchParams.get(CONTEXT_PARAM.role);
    const wantedOffering = searchParams.get(CONTEXT_PARAM.offering);
    const activeContext =
        contexts.find(
            (context) =>
                context.institution.id === wantedInstitution &&
                context.role.id === wantedRole &&
                (!wantedOffering || context.offering?.id === wantedOffering),
        ) ?? contexts[0];
    const institutionItems = activeContext
        ? INSTITUTION_ITEMS.filter((item) =>
              hasAnyPermission(activeContext.permissions, item.permissions),
          )
        : [];

    /**
     * Mọi liên kết điều hướng mang theo ngữ cảnh đang hoạt động.
     *
     * ─── Vì sao không thể bỏ đoạn này ────────────────────────────────────────
     *
     * Không có nó thì chuyển trang là mất vai trò: URL mới không mang ba tham số kia, máy chủ rơi
     * về ngữ cảnh mặc định, và người dùng lặng lẽ bị đổi tư cách giữa chừng — thấy dữ liệu của
     * một vai trò khác mà không có gì báo.
     *
     * Chép qua theo TÊN KHOÁ chứ không chép cả query string: bộ lọc và số trang của trang cũ
     * không có nghĩa ở trang mới.
     */
    function withContext(href: string): string {
        const carried = new URLSearchParams();

        for (const key of Object.values(CONTEXT_PARAM)) {
            const value = searchParams.get(key);
            if (value) {
                carried.set(key, value);
            }
        }

        const query = carried.toString();
        return query ? href + '?' + query : href;
    }

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" render={<Link href="/" />}>
                            <BrandLogo className="size-8 shrink-0" gradientId="ailearn-mark-nav" />
                            <div className="grid flex-1 text-left leading-tight">
                                <span className="font-heading truncate font-semibold">
                                    AI-Learn
                                </span>
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
                    <SidebarGroupLabel>Personal</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {PERSONAL_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        isActive={pathname.startsWith(item.href)}
                                        tooltip={item.label}
                                        render={<Link href={withContext(item.href)} />}
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
                    <SidebarGroupLabel>Access Control</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {ACCESS_CONTROL_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        isActive={pathname.startsWith(item.href)}
                                        tooltip={item.label}
                                        render={<Link href={withContext(item.href)} />}
                                    >
                                        <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                                        <span>{item.label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {institutionItems.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Institution</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {institutionItems.map((item) => (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            isActive={pathname.startsWith(item.href)}
                                            tooltip={item.label}
                                            render={<Link href={withContext(item.href)} />}
                                        >
                                            <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                <SidebarGroup>
                    <SidebarGroupLabel>Tools</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {TOOL_ITEMS.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        isActive={pathname.startsWith(item.href)}
                                        tooltip={item.label}
                                        render={<Link href={withContext(item.href)} />}
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
                <p className="text-muted-foreground px-3 py-2 text-xs leading-relaxed group-data-[collapsible=icon]:hidden">
                    Every session is recorded, and plays back from the start.
                </p>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

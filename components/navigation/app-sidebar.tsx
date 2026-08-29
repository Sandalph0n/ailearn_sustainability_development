"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BookOpen01Icon,
  Calendar03Icon,
  Home01Icon,
  SourceCodeIcon,
  TaskDone01Icon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons";

import { BrandLogo } from "@/components/brand-logo";
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
} from "@/components/ui/sidebar";

/**
 * Mục điều hướng, để thành DỮ LIỆU — thêm một mục là thêm một dòng.
 *
 * Chia hai nhóm vì hai loại việc khác nhau: một bên là xem và theo dõi, một bên là ngồi xuống
 * làm. Gộp chung thì danh sách dài dần rồi không ai tìm thấy gì.
 */
const STUDY_ITEMS = [
  { href: "/navigation/dashboard", label: "Dashboard", icon: Home01Icon },
  { href: "/navigation/subjects", label: "Subjects", icon: BookOpen01Icon },
  {
    href: "/navigation/assessments",
    label: "Assessments",
    icon: TaskDone01Icon,
  },
  { href: "/navigation/calendar", label: "Calendar", icon: Calendar03Icon },
] as const;

const TOOL_ITEMS = [
  { href: "/tools/code", label: "Code", icon: SourceCodeIcon },
  { href: "/tools/diagram", label: "Diagram", icon: WorkflowSquare01Icon },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <BrandLogo
                className="size-8 shrink-0"
                gradientId="ailearn-mark-nav"
              />
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
          <SidebarGroupLabel>Study</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {STUDY_ITEMS.map((item) => (
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
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOOL_ITEMS.map((item) => (
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

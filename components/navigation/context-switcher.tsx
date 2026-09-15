'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Shield01Icon, Tick02Icon, UniversityIcon } from '@hugeicons/core-free-icons';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { pictureUrl } from '@/components/media/picture-url';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    CONTEXT_PARAM,
    contextKey,
    contextLabel,
    distinctRoleContexts,
    type ContextOption,
} from '@/lib/context/context-params';

/**
 * Bộ chọn "tôi đang hành động dưới danh nghĩa nào".
 *
 * ─── Vì sao ở HEADER, không phải trong sidebar ───────────────────────────────
 *
 * Sidebar là chỗ quen thuộc cho một bộ chuyển workspace, nhưng ở đây nó chạy
 * `collapsible="icon"`: thu gọn lại thì mục này chỉ còn một biểu tượng không nhãn. Vai trò đang
 * giữ phải ĐỌC ĐƯỢC mọi lúc — nhầm vai trò nghĩa là nhìn nhầm dữ liệu của người khác, và một
 * biểu tượng câm không cảnh báo được điều đó. Header thì không thu gọn bao giờ.
 *
 * Đặt SÁT nút tài khoản ở góc phải, ngăn bằng một vạch dọc. Hai thứ trả lời hai câu hỏi liền
 * nhau — "tôi đang làm việc với tư cách gì" và "tôi là ai" — nên đứng cạnh nhau thì người dùng
 * đọc được cả hai trong một lần nhìn, thay vì phải quét ngang cả thanh header.
 *
 * ─── Vì sao đọc `useSearchParams` thay vì nhận `active` qua props ───────────
 *
 * Component này sống trong `layout.tsx`, mà layout của App Router KHÔNG nhận `searchParams` —
 * chỉ page mới có. Danh sách lựa chọn thì layout lấy được (nó chỉ cần `userId`), còn cái nào
 * đang hoạt động thì phải đọc từ phía trình duyệt.
 *
 * Hệ quả cần biết: đây là phép so khớp để HIỂN THỊ. Phép kiểm thật nằm ở
 * `resolveActiveContext()` phía máy chủ, nơi mọi trang tự đối chiếu URL với database trước khi
 * truy vấn bất cứ thứ gì.
 */
export function ContextSwitcher({ options }: { options: ContextOption[] }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    if (options.length === 0) {
        return (
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
                <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="size-4" />
                No role yet
            </span>
        );
    }

    const wantedInstitution = searchParams.get(CONTEXT_PARAM.institution);
    const wantedRole = searchParams.get(CONTEXT_PARAM.role);
    const wantedOffering = searchParams.get(CONTEXT_PARAM.offering);

    const active =
        options.find(
            (option) =>
                option.institution.id === wantedInstitution &&
                option.role.id === wantedRole &&
                (!wantedOffering || option.offering?.id === wantedOffering),
        ) ?? options[0];
    const roleOptions = distinctRoleContexts(options);

    function select(option: ContextOption) {
        // Dựng từ tham số HIỆN CÓ, không dựng từ rỗng: trang có thể đang mang bộ lọc, số trang,
        // từ khoá tìm kiếm. Đổi vai trò không được xoá những thứ đó.
        const next = new URLSearchParams(searchParams);
        next.set(CONTEXT_PARAM.institution, option.institution.id);
        next.set(CONTEXT_PARAM.role, option.role.id);
        // Chọn một RoleAssignment, không chọn một trong hàng chục offering mà role đó phủ.
        next.delete(CONTEXT_PARAM.offering);

        const destination = new URL(pathname, window.location.origin);
        destination.search = next.toString();
        window.location.assign(destination);
    }

    // Gom theo cơ sở, giữ nguyên thứ tự máy chủ đã sắp (tên cơ sở, rồi tên vai trò).
    const grouped = new Map<string, { name: string; items: ContextOption[] }>();
    for (const option of roleOptions) {
        const bucket = grouped.get(option.institution.id);
        if (bucket) {
            bucket.items.push(option);
        } else {
            grouped.set(option.institution.id, {
                name: option.institution.name,
                items: [option],
            });
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        className="h-11 max-w-64 justify-start gap-2 px-2"
                        aria-label={`Acting as ${contextLabel(active)} at ${active.institution.name}`}
                    >
                        <Avatar className="size-7 rounded-md after:rounded-md">
                            <AvatarImage
                                src={pictureUrl(active.institution.logoKey)}
                                alt=""
                                className="rounded-md"
                            />
                            <AvatarFallback className="bg-brand-teal/12 text-brand-teal rounded-md">
                                <HugeiconsIcon
                                    icon={UniversityIcon}
                                    strokeWidth={2}
                                    className="size-4"
                                />
                            </AvatarFallback>
                        </Avatar>
                        <span className="grid flex-1 text-left leading-tight">
                            <span className="truncate text-sm font-medium">
                                {contextLabel(active)}
                            </span>
                            <span className="text-muted-foreground truncate text-xs font-normal">
                                {active.institution.name}
                            </span>
                        </span>
                        <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            strokeWidth={2}
                            className="text-muted-foreground size-4 shrink-0"
                        />
                    </Button>
                }
            />

            <DropdownMenuContent align="end" className="w-72">
                {Array.from(grouped.values()).map((group, index) => (
                    <DropdownMenuGroup key={group.name}>
                        {index > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel>{group.name}</DropdownMenuLabel>

                        {group.items.map((option) => {
                            const key = contextKey(option);
                            const isActive = option.assignmentId === active.assignmentId;

                            return (
                                <DropdownMenuItem
                                    key={key}
                                    onClick={() => select(option)}
                                >
                                    <HugeiconsIcon
                                        icon={Tick02Icon}
                                        strokeWidth={2}
                                        className={isActive ? 'text-brand-teal' : 'opacity-0'}
                                    />
                                    <span className="truncate">{option.role.roleName}</span>
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuGroup>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

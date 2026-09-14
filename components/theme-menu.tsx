'use client';

import { ComputerIcon, MoonIcon, SunIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { useTheme, type Theme } from '@/components/theme-provider';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Menu chọn giao diện: Light, Dark, System.
 *
 * Bản base44 trước đây là một nút bấm xoay vòng ba trạng thái; commit 1885d7c hôm nay đổi thành
 * menu thả xuống, vì nút xoay vòng không cho biết đang ở đâu và muốn tới đâu — phải bấm thử.
 *
 * ─── Vì sao `DropdownMenuRadioGroup` ─────────────────────────────────────────
 *
 * Bản base44 dùng `DropdownMenuItem` thường rồi tự vẽ dấu tick cho mục đang chọn. Bộ ui bên này
 * đã có sẵn radio item với dấu tick dựng sẵn, và quan trọng hơn là nó phát ra đúng vai trò ARIA
 * `menuitemradio` — trình đọc màn hình đọc được "đang chọn mục nào trong ba mục".
 */

const OPTIONS = [
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'system', label: 'System', icon: ComputerIcon },
] as const;

export function ThemeMenu() {
    const { theme, setTheme } = useTheme();

    // Máy chủ luôn dựng ra `system`, nên biểu tượng có thể đổi một nhịp ngay sau khi tải xong nếu
    // người dùng đã chọn sáng hoặc tối. Chỉ là một biểu tượng nhỏ đổi hình, không xô lệch bố cục.
    const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[2];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label="Change theme"
                className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex size-10 cursor-pointer items-center justify-center rounded-4xl transition-colors outline-none focus-visible:ring-2"
            >
                <HugeiconsIcon icon={current.icon} strokeWidth={2} className="size-5" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={(value) => setTheme(value as Theme)}
                >
                    {OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                            <HugeiconsIcon
                                icon={option.icon}
                                strokeWidth={2}
                                className="text-muted-foreground"
                            />
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

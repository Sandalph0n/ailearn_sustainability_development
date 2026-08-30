'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type UrlFilterOption = { value: string; label: string };

/** Bộ lọc select nhỏ, do bảng sở hữu việc ghi URL để mọi filter dùng chung một snapshot. */
export function UrlSelectFilter({
    value,
    options,
    placeholder,
    ariaLabel,
    onChange,
    className,
}: {
    value: string | null;
    options: UrlFilterOption[];
    placeholder: string;
    ariaLabel: string;
    onChange: (value: string | null) => void;
    className?: string;
}) {
    return (
        <div className="flex shrink-0 items-center gap-1">
            <Select
                items={Object.fromEntries(options.map((option) => [option.value, option.label]))}
                value={value ?? ''}
                onValueChange={(next) => onChange(next || null)}
            >
                <SelectTrigger className={cn('w-44', className)} aria-label={ariaLabel}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {value && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Clear ${ariaLabel.toLowerCase()}`}
                    onClick={() => onChange(null)}
                >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
            )}
        </div>
    );
}

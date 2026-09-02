'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    SearchIcon,
} from '@hugeicons/core-free-icons';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export type TransferListOption = {
    value: string;
    label: string;
    description?: string;
};

/**
 * Field chọn nhiều theo mô hình transfer list.
 *
 * Mỗi giá trị chỉ nằm ở một phía: chưa chọn ở `Choose from`, đã chọn ở `Selected`. Danh sách
 * nguồn có tìm kiếm riêng để số lượng permission lớn vẫn dễ quét; hai nút mũi tên là thao tác
 * duy nhất làm thay đổi giá trị của field.
 */
export function FormTransferList<
    TValues extends FieldValues,
    TTransformedValues extends FieldValues = TValues,
>({
    control,
    name,
    label,
    description,
    options,
    searchPlaceholder = 'Search available options…',
    availableEmptyMessage = 'No available options.',
    selectedEmptyMessage = 'Nothing selected yet.',
}: {
    control: Control<TValues, unknown, TTransformedValues>;
    name: FieldPath<TValues>;
    label: string;
    description?: string;
    options: TransferListOption[];
    searchPlaceholder?: string;
    availableEmptyMessage?: string;
    selectedEmptyMessage?: string;
}) {
    const [query, setQuery] = useState('');
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState }) => {
                const selectedValues = Array.isArray(field.value) ? (field.value as string[]) : [];
                const selected = options.filter((option) => selectedValues.includes(option.value));
                const available = options.filter((option) => {
                    if (selectedValues.includes(option.value)) return false;
                    if (!normalizedQuery) return true;

                    return `${option.label} ${option.description ?? ''}`
                        .toLocaleLowerCase()
                        .includes(normalizedQuery);
                });

                const add = (value: string) => {
                    field.onChange([...selectedValues, value]);
                    field.onBlur();
                };
                const remove = (value: string) => {
                    field.onChange(selectedValues.filter((selectedValue) => selectedValue !== value));
                    field.onBlur();
                };

                return (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldContent>
                            <FieldLabel>{label}</FieldLabel>
                            {description && <FieldDescription>{description}</FieldDescription>}
                        </FieldContent>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <TransferPanel title="Choose from" count={available.length}>
                                <div className="border-border relative border-b p-2.5">
                                    <HugeiconsIcon
                                        icon={SearchIcon}
                                        strokeWidth={2}
                                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2"
                                    />
                                    <Input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder={searchPlaceholder}
                                        aria-label={`Search ${label.toLocaleLowerCase()}`}
                                        className="h-9 pl-9"
                                    />
                                </div>
                                <TransferItems
                                    options={available}
                                    emptyMessage={
                                        normalizedQuery
                                            ? `No results for “${query.trim()}”.`
                                            : availableEmptyMessage
                                    }
                                    direction="add"
                                    onMove={add}
                                />
                            </TransferPanel>

                            <TransferPanel title="Selected" count={selected.length}>
                                <TransferItems
                                    options={selected}
                                    emptyMessage={selectedEmptyMessage}
                                    direction="remove"
                                    onMove={remove}
                                />
                            </TransferPanel>
                        </div>

                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    </Field>
                );
            }}
        />
    );
}

function TransferPanel({
    title,
    count,
    children,
}: {
    title: string;
    count: number;
    children: React.ReactNode;
}) {
    return (
        <section className="border-border bg-card flex min-h-80 flex-col overflow-hidden rounded-md border">
            <header className="border-border flex h-11 items-center justify-between border-b px-3.5">
                <h4 className="text-sm font-medium">{title}</h4>
                <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
            </header>
            {children}
        </section>
    );
}

function TransferItems({
    options,
    emptyMessage,
    direction,
    onMove,
}: {
    options: TransferListOption[];
    emptyMessage: string;
    direction: 'add' | 'remove';
    onMove: (value: string) => void;
}) {
    const adding = direction === 'add';

    if (options.length === 0) {
        return (
            <div className="text-muted-foreground flex flex-1 items-center justify-center px-5 py-10 text-center text-sm">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="max-h-72 min-h-0 flex-1 overflow-y-auto p-1.5">
            {options.map((option) => (
                <div
                    key={option.value}
                    className="hover:bg-muted/60 group flex min-h-14 items-center gap-3 rounded-sm px-2.5 py-2 transition-colors"
                >
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-medium">{option.label}</p>
                        {option.description && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-4">
                                {option.description}
                            </p>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onMove(option.value)}
                        aria-label={`${adding ? 'Select' : 'Remove'} ${option.label}`}
                        title={adding ? 'Move to selected' : 'Move back to available'}
                        className="shrink-0"
                    >
                        <HugeiconsIcon
                            icon={adding ? ArrowRight01Icon : ArrowLeft01Icon}
                            strokeWidth={2}
                        />
                    </Button>
                </div>
            ))}
        </div>
    );
}

'use client';

import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export type CheckboxListOption = {
    value: string;
    label: string;
    description?: string;
};

/** Danh sách chọn nhiều gọn hơn một multi-select và luôn cho thấy mình đang cấp những gì. */
export function FormCheckboxList<TValues extends FieldValues>({
    control,
    name,
    label,
    description,
    emptyMessage,
    options,
}: {
    control: Control<TValues>;
    name: FieldPath<TValues>;
    label: string;
    description?: string;
    emptyMessage: string;
    options: CheckboxListOption[];
}) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState }) => {
                const selected = Array.isArray(field.value) ? (field.value as string[]) : [];
                return (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldContent>
                            <FieldLabel>{label}</FieldLabel>
                            {description && <FieldDescription>{description}</FieldDescription>}
                        </FieldContent>

                        {options.length === 0 ? (
                            <div className="border-border/70 text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
                                {emptyMessage}
                            </div>
                        ) : (
                            <div
                                className={cn(
                                    'border-border/70 max-h-48 space-y-1 overflow-y-auto rounded-md border p-1.5',
                                    fieldState.invalid && 'border-destructive',
                                )}
                            >
                                {options.map((option) => {
                                    const checked = selected.includes(option.value);
                                    return (
                                        <label
                                            key={option.value}
                                            className="hover:bg-muted/60 flex cursor-pointer items-start gap-2.5 rounded-sm px-2 py-2"
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(next) => {
                                                    field.onChange(
                                                        next
                                                            ? [...selected, option.value]
                                                            : selected.filter(
                                                                  (value) => value !== option.value,
                                                              ),
                                                    );
                                                }}
                                            />
                                            <span className="min-w-0 text-sm leading-5">
                                                <span className="block font-medium">{option.label}</span>
                                                {option.description && (
                                                    <span className="text-muted-foreground block text-xs">
                                                        {option.description}
                                                    </span>
                                                )}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    </Field>
                );
            }}
        />
    );
}

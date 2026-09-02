'use client';

import type { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import { useResourceForm } from '@/components/admin/use-resource-form';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * Khung tạo/sửa dùng chung cho khu quản trị.
 *
 * Khung này chỉ sở hữu vòng đời của form, tiêu đề và thanh hành động. Nội dung được truyền qua
 * `children` để từng tài nguyên tự chọn bố cục phù hợp; một role nhiều danh sách lựa chọn không
 * nên bị ép vào cùng một cột với một offering chỉ có hai ô.
 */
export function ResourceFormPage<TInput extends FieldValues, TOutput extends FieldValues>({
    schema,
    emptyValues,
    editing,
    createEndpoint,
    title,
    description,
    submitLabel,
    onCancel,
    onSaved,
    children,
}: {
    schema: z.ZodType<TOutput, TInput>;
    emptyValues: TInput;
    editing?: { id: string; values: TInput };
    createEndpoint: string;
    title: { create: string; edit: string };
    description: { create: string; edit: string };
    submitLabel?: { create: string; edit: string };
    onCancel: () => void;
    onSaved?: () => void;
    children: (form: UseFormReturn<TInput, unknown, TOutput>) => ReactNode;
}) {
    const isEdit = editing !== undefined;
    const form = useForm<TInput, unknown, TOutput>({
        resolver: zodResolver(schema as never),
        defaultValues: (editing?.values ?? emptyValues) as never,
    });
    const submit = useResourceForm(form);

    async function onSubmit(values: TOutput) {
        const succeeded = await submit(
            isEdit ? `${createEndpoint}/${editing.id}` : createEndpoint,
            isEdit ? 'PATCH' : 'POST',
            values,
        );

        if (succeeded) (onSaved ?? onCancel)();
    }

    return (
        <section className="bg-background -mx-5 min-h-[calc(100dvh-4rem)] px-5 pb-10 md:-mx-6 md:px-6">
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
                className="mx-auto flex w-full max-w-7xl flex-col"
            >
                <header className="border-border flex flex-wrap items-start gap-4 border-b py-6">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={onCancel}
                        disabled={form.formState.isSubmitting}
                        aria-label="Back to list"
                        className="mt-0.5 -ml-2"
                    >
                        <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} />
                    </Button>

                    <div className="min-w-0 flex-1">
                        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                            {isEdit ? 'Edit record' : 'Create record'}
                        </p>
                        <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
                            {isEdit ? title.edit : title.create}
                        </h2>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                            {isEdit ? description.edit : description.create}
                        </p>
                    </div>
                </header>

                <FormAlert message={form.formState.errors.root?.message} />

                <div className="py-7">{children(form)}</div>

                <footer className="border-border bg-background/95 sticky bottom-0 z-10 mt-auto flex items-center justify-end gap-3 border-t py-4 backdrop-blur-sm">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={form.formState.isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Spinner />}
                        {isEdit
                            ? (submitLabel?.edit ?? 'Save changes')
                            : (submitLabel?.create ?? 'Create')}
                    </Button>
                </footer>
            </form>
        </section>
    );
}

/** Một nhóm có nhãn; grid bên trong vẫn do form cụ thể quyết định. */
export function ResourceFormSection({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'border-border flex flex-col gap-4 border-t py-6 first:border-t-0 first:pt-0',
                className,
            )}
        >
            <div>
                <h3 className="font-heading text-sm font-semibold">{title}</h3>
                {description && (
                    <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
                        {description}
                    </p>
                )}
            </div>
            <div className="min-w-0">{children}</div>
        </section>
    );
}

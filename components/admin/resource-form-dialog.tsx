'use client';

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import { useResourceForm } from '@/components/admin/use-resource-form';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';

/**
 * Hộp thoại tạo mới HOẶC sửa, dùng chung cho mọi thực thể trong khu quản trị.
 *
 * ─── Vì sao gói lại thay vì chép cho từng bảng ──────────────────────────────
 *
 * Phần khác nhau giữa các thực thể chỉ là DANH SÁCH Ô NHẬP. Còn lại — mở/đóng, nạp lại giá trị
 * mỗi lần mở, gọi API, đưa lỗi server về đúng ô, giữ hộp thoại mở khi thất bại, làm mới danh
 * sách — giống hệt nhau. Chép bảy lần thì bảy bản sẽ lệch, và lỗi sửa ở một chỗ vẫn còn ở sáu
 * chỗ kia.
 *
 * Chỗ gọi chỉ đưa vào: schema, giá trị mặc định, đường dẫn API, và một hàm vẽ các ô nhập.
 *
 * ─── Vì sao `fields` là một HÀM, không phải `children` ──────────────────────
 *
 * Các ô nhập cần `form.control` để nối vào react-hook-form, mà `form` được tạo BÊN TRONG
 * component này. Truyền `children` thì chỗ gọi không có gì để nối vào.
 */
export function ResourceFormDialog<TInput extends FieldValues, TOutput extends FieldValues>({
    schema,
    emptyValues,
    /** Có mặt = đang sửa. Vắng = đang tạo mới. */
    editing,
    createEndpoint,
    title,
    description,
    submitLabel,
    trigger,
    fields,
}: {
    schema: z.ZodType<TOutput, TInput>;
    emptyValues: TInput;
    editing?: { id: string; values: TInput };
    /** Đường dẫn tạo mới. Khi sửa, `/{id}` được nối thêm và gửi bằng `PATCH`. */
    createEndpoint: string;
    title: { create: string; edit: string };
    description: { create: string; edit: string };
    submitLabel?: { create: string; edit: string };
    trigger: ReactElement;
    fields: (form: UseFormReturn<TInput, unknown, TOutput>) => ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const isEdit = editing !== undefined;

    const form = useForm<TInput, unknown, TOutput>({
        // `zodResolver` không suy được cặp vào/ra khi schema đến từ generic, nên phải ép ở đây.
        // Ràng buộc thật vẫn do prop `schema` giữ.
        resolver: zodResolver(schema as never),
        defaultValues: emptyValues as never,
    });

    const submit = useResourceForm(form);

    /**
     * Nạp lại giá trị mỗi lần MỞ.
     *
     * react-hook-form chỉ đọc `defaultValues` một lần lúc khởi tạo, mà component này sống suốt
     * vòng đời của hàng trong bảng. Thiếu bước này thì mở–sửa–đóng rồi mở lại sẽ thấy những gì
     * gõ dở lần trước.
     */
    useEffect(() => {
        if (!open) return;
        form.reset((editing ? editing.values : emptyValues) as never);
        // `emptyValues` là object dựng mới mỗi lần render nên không đưa vào danh sách phụ thuộc;
        // nó chỉ được đọc khi `open` chuyển sang true.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editing]);

    async function onSubmit(values: TOutput) {
        const succeeded = await submit(
            isEdit ? `${createEndpoint}/${editing.id}` : createEndpoint,
            isEdit ? 'PATCH' : 'POST',
            values,
        );

        // Thất bại thì GIỮ hộp thoại mở — lỗi đã nằm trong biểu mẫu, và những gì vừa gõ còn nguyên.
        if (succeeded) setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={trigger} />

            <DialogContent className="sm:max-w-lg">
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                    <DialogHeader>
                        <DialogTitle>{isEdit ? title.edit : title.create}</DialogTitle>
                        <DialogDescription>
                            {isEdit ? description.edit : description.create}
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup className="py-6">
                        <FormAlert message={form.formState.errors.root?.message} />
                        {fields(form)}
                    </FieldGroup>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
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
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

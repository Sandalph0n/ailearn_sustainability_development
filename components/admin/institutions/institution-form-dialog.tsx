'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FormAlert } from '@/components/auth/form-alert';
import { useResourceForm } from '@/components/admin/use-resource-form';
import { FormInput } from '@/components/form';
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
import {
    EMPTY_INSTITUTION_FORM,
    InstitutionSchema,
    type InstitutionFormValue,
    type InstitutionSchemaValue,
} from '@/lib/admin/institution-schema';

export type InstitutionRow = {
    id: string;
    name: string;
    website: string | null;
};

/**
 * Hộp thoại tạo mới HOẶC sửa một cơ sở giáo dục.
 *
 * ─── Vì sao một hộp thoại cho cả hai việc ────────────────────────────────────
 *
 * Hai biểu mẫu giống nhau từng ô; chỉ khác đích gửi (`POST /…` với `PATCH /…/:id`) và vài dòng
 * chữ. Tách đôi thì mỗi lần thêm một trường phải sửa hai chỗ, và sớm muộn cũng quên một bên.
 *
 * `institution` có mặt nghĩa là đang sửa, vắng nghĩa là đang tạo.
 */
export function InstitutionFormDialog({
    institution,
    trigger,
}: {
    institution?: InstitutionRow;
    trigger: ReactElement;
}) {
    const [open, setOpen] = useState(false);
    const editing = institution !== undefined;

    // Ba tham số vì schema có `.transform()`: ô nhập giữ `InstitutionFormValue`, còn
    // `handleSubmit` đưa xuống `InstitutionSchemaValue` đã qua biến đổi.
    const form = useForm<InstitutionFormValue, unknown, InstitutionSchemaValue>({
        resolver: zodResolver(InstitutionSchema),
        defaultValues: EMPTY_INSTITUTION_FORM,
    });

    const submit = useResourceForm(form);

    /**
     * Nạp lại giá trị mỗi lần mở.
     *
     * Cần thiết vì react-hook-form chỉ đọc `defaultValues` một lần lúc khởi tạo, mà component
     * này sống suốt vòng đời của hàng trong bảng. Không có bước này thì: mở-sửa-đóng rồi mở lại
     * sẽ thấy những gì gõ dở lần trước, và hộp thoại "New" sẽ mang theo dữ liệu của hàng cũ.
     */
    useEffect(() => {
        if (!open) return;

        form.reset(
            institution
                ? { name: institution.name, website: institution.website ?? '' }
                : EMPTY_INSTITUTION_FORM,
        );
    }, [open, institution, form]);

    async function onSubmit(values: InstitutionSchemaValue) {
        const succeeded = await submit(
            editing ? `/api/admin/institutions/${institution.id}` : '/api/admin/institutions',
            editing ? 'PATCH' : 'POST',
            values,
        );

        // Thất bại thì GIỮ hộp thoại mở — lỗi đã nằm sẵn trong biểu mẫu, và những gì người dùng
        // vừa gõ vẫn còn nguyên để sửa.
        if (succeeded) {
            setOpen(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={trigger} />

            <DialogContent className="sm:max-w-lg">
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Edit institution' : 'New institution'}
                        </DialogTitle>
                        <DialogDescription>
                            {editing
                                ? 'Changes apply everywhere this institution appears.'
                                : 'Add a school or university to the platform.'}
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup className="py-6">
                        <FormAlert message={form.formState.errors.root?.message} />

                        <FormInput
                            control={form.control}
                            name="name"
                            label="Name"
                            placeholder="Macquarie University"
                            autoComplete="off"
                        />

                        <FormInput
                            control={form.control}
                            name="website"
                            label="Website"
                            description="Optional. Include https://"
                            placeholder="https://mq.edu.au"
                            autoComplete="off"
                        />
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
                            {editing ? 'Save changes' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

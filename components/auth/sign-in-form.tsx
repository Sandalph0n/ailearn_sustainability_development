'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FormInput } from '@/components/form';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { LoginSchema, type LoginSchemaValue } from '@/lib/auth/validation/credentials';

import { useAuthSubmit } from './use-auth-submit';
import { FormAlert } from './form-alert';

/**
 * Biểu mẫu đăng nhập, nối với `POST /api/auth/login`.
 *
 * Dùng CHUNG `LoginSchema` với route handler. Một schema, hai nơi kiểm: client kiểm để báo lỗi
 * ngay khi gõ, server kiểm vì không bao giờ được tin client. Không phải trùng lặp — cùng một
 * nguồn luật, chạy ở hai chỗ vì hai mục đích khác nhau.
 */
export function SignInForm() {
    const form = useForm<LoginSchemaValue>({
        resolver: zodResolver(LoginSchema),
        // Cần giá trị khởi tạo, nếu không React coi ô nhập là uncontrolled rồi kêu ầm lên khi
        // người dùng gõ chữ đầu tiên.
        defaultValues: { email: '', password: '' },
    });

    const submit = useAuthSubmit('/api/auth/login', form);
    const { isSubmitting } = form.formState;

    return (
        <form onSubmit={form.handleSubmit(submit)} noValidate>
            <FieldGroup>
                <FormAlert message={form.formState.errors.root?.message} />

                <FormInput
                    control={form.control}
                    name="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@school.edu"
                />

                <FormInput
                    control={form.control}
                    name="password"
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Spinner />}
                    Sign in
                </Button>
            </FieldGroup>
        </form>
    );
}

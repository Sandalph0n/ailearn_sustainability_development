'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FormInput } from '@/components/form';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { SignUpSchema, type SignUpSchemaValue } from '@/lib/auth/validation/credentials';

import { useAuthSubmit } from './use-auth-submit';
import { FormAlert } from './form-alert';

/**
 * Biểu mẫu đăng ký, nối với `POST /api/auth/register`.
 *
 * Route đó tạo tài khoản RỒI ĐĂNG NHẬP LUÔN — nó đặt cookie phiên ngay trong phản hồi. Nên đăng
 * ký xong đi thẳng vào ứng dụng, không bắt người dùng gõ lại email và mật khẩu vừa đặt.
 *
 * Không hỏi cơ sở giáo dục ở đây. Một người có thể thuộc nhiều cơ sở, và quan hệ đó nằm ở
 * `RoleAssignment` chứ không phải một cột trên `User` — nên nó thuộc về một luồng riêng sau khi
 * đã có tài khoản, không phải một ô trong biểu mẫu đăng ký.
 */
export function SignUpForm() {
    const form = useForm<SignUpSchemaValue>({
        resolver: zodResolver(SignUpSchema),
        defaultValues: { email: '', password: '', firstName: '', lastName: '' },
    });

    const submit = useAuthSubmit('/api/auth/register', form);
    const { isSubmitting } = form.formState;

    return (
        <form onSubmit={form.handleSubmit(submit)} noValidate>
            <FieldGroup>
                <FormAlert message={form.formState.errors.root?.message} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormInput
                        control={form.control}
                        name="firstName"
                        label="First name"
                        autoComplete="given-name"
                    />
                    <FormInput
                        control={form.control}
                        name="lastName"
                        label="Last name"
                        autoComplete="family-name"
                    />
                </div>

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
                    description="At least 12 characters."
                    type="password"
                    // `new-password` để trình duyệt gợi ý tạo mật khẩu mạnh thay vì điền lại cái cũ.
                    autoComplete="new-password"
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Spinner />}
                    Create account
                </Button>
            </FieldGroup>
        </form>
    );
}

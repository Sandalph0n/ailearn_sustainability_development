'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/**
 * Biểu mẫu đăng nhập — THUẦN GIAO DIỆN.
 *
 * Chưa nối với `/api/auth/login`. `onSubmit` mới chỉ chặn hành vi nạp lại trang mặc định của
 * trình duyệt, chưa gửi đi đâu cả.
 *
 * Tên các ô khớp với `loginSchema`: `email`, `password`.
 */
export function SignInForm() {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                // TODO(logic): gọi POST /api/auth/login
            }}
        >
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="signin-email">Email</FieldLabel>
                    <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@school.edu"
                        required
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="signin-password">Password</FieldLabel>
                    <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                    />
                </Field>

                <Button type="submit" className="w-full">
                    Sign in
                </Button>
            </FieldGroup>
        </form>
    );
}

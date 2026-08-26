'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/**
 * Biểu mẫu đăng ký — THUẦN GIAO DIỆN.
 *
 * Chưa nối với `/api/auth/register`.
 *
 * Tên các ô khớp với `registerSchema`: `firstName`, `lastName`, `email`, `password`.
 *
 * ─── Cố ý KHÔNG hỏi cơ sở giáo dục ───────────────────────────────────────────
 *
 * Một người có thể thuộc nhiều cơ sở, nên bắt chọn ngay lúc đăng ký là mô hình sai: nó giả định
 * mỗi người chỉ có đúng một trường.
 *
 * Hướng đang cân nhắc: tạo tài khoản trước, liên kết với cơ sở sau — từ trong ứng dụng, và liên
 * kết được nhiều lần.
 *
 * ─── Hệ quả: biểu mẫu này CHƯA gửi được ──────────────────────────────────────
 *
 * `registerSchema` hiện vẫn bắt buộc `institutionId`, nên gọi API mà thiếu nó sẽ bị trả về
 * `VALIDATION_ERROR`. Phải sửa schema trước khi nối phần gửi.
 */
export function SignUpForm() {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                // TODO(logic): gọi POST /api/auth/register
            }}
        >
            <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                    <Field>
                        <FieldLabel htmlFor="signup-first-name">First name</FieldLabel>
                        <Input
                            id="signup-first-name"
                            name="firstName"
                            autoComplete="given-name"
                            placeholder="Alex"
                            required
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="signup-last-name">Last name</FieldLabel>
                        <Input
                            id="signup-last-name"
                            name="lastName"
                            autoComplete="family-name"
                            placeholder="Morgan"
                            required
                        />
                    </Field>
                </div>

                <Field>
                    <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                    <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@school.edu"
                        required
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                    <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                    />
                </Field>

                <Button type="submit" className="w-full">
                    Create account
                </Button>
            </FieldGroup>
        </form>
    );
}

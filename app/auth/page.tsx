import { HugeiconsIcon } from '@hugeicons/react';
import {
    StudentIcon,
    TimeQuarterPassIcon,
    ToolCaseIcon,
    Calendar03Icon,
} from '@hugeicons/core-free-icons';

import { SignInForm } from '@/components/auth/sign-in-form';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Trang tài khoản: đăng nhập và đăng ký trong CÙNG một trang, chuyển qua lại bằng tab.
 *
 * ─── Vì sao một trang chứ không phải hai đường dẫn ───────────────────────────
 *
 * Người dùng thường không chắc mình đã có tài khoản chưa. Hai đường dẫn riêng thì mỗi lần đổi ý
 * là một lần tải trang và mất những gì đã gõ. Cùng một trang thì chỉ là đổi tab.
 *
 * ─── Vì sao một tấm card ở giữa, không phải chia đôi cả trang ────────────────
 *
 * Nội dung ở đây ít. Trải nó ra toàn màn hình thì hai nửa đều loãng và mắt không biết nhìn vào
 * đâu. Gom vào một tấm card có ranh giới rõ thì nội dung đặc lại, còn phần nền quanh nó nhận
 * nhiệm vụ trang trí.
 *
 * Bên trong card vẫn chia đôi: biểu mẫu cần ngắn, nhưng người lần đầu vào cần biết đây là gì.
 * Màn hình hẹp thì nửa trái ẩn đi, chỉ còn phần nhận diện thu gọn phía trên biểu mẫu.
 *
 * ─── Vì sao nằm ngoài `/navigation` ──────────────────────────────────────────
 *
 * Nhánh kia có sidebar và được proxy bảo vệ. Để trang này ở đó thì người chưa đăng nhập bị đá về
 * chính nó, lặp vô tận. Bản thân đường dẫn `/auth` đã đủ tách bạch.
 *
 * ─── CẢNH BÁO: tham số `next` ────────────────────────────────────────────────
 *
 * `proxy.ts` gắn `?next=<đường dẫn>` khi đá người chưa đăng nhập về đây, để đăng nhập xong quay
 * lại đúng chỗ họ định tới.
 *
 * Giá trị đó đến từ URL, nghĩa là bất kỳ ai cũng đặt được. Phía đăng nhập PHẢI kiểm trước khi
 * chuyển hướng theo. Nhận bừa là mở lỗ hổng chuyển hướng — kẻ tấn công gửi
 * `/auth?next=https://tencuop.example`, người dùng đăng nhập xong bị đẩy sang trang giả mạo và
 * gõ lại mật khẩu ở đó.
 *
 * Chỉ chấp nhận đường dẫn nội bộ: bắt đầu bằng đúng một dấu `/` và không phải `//` (vì `//host`
 * là URL tuyệt đối thiếu giao thức, trình duyệt vẫn đi ra ngoài). Sai thì rơi về mặc định.
 */

const HIGHLIGHTS = [
    {
        icon: TimeQuarterPassIcon,
        title: 'Replay the work',
        description: 'Every action is recorded in order, and plays back from the start.',
    },
    {
        icon: ToolCaseIcon,
        title: 'Many tools, one place',
        description: 'Code and diagrams today, more as your subjects need them.',
    },
    {
        icon: Calendar03Icon,
        title: 'Deadlines that find you',
        description: 'Due dates, class schedules, and anything you add yourself.',
    },
] as const;

export default function AuthPage() {
    return (
        <div className="bg-muted/40 relative flex min-h-svh items-center justify-center overflow-hidden p-4 md:p-8">
            {/*
                Nền trang trí. Cả ba lớp đều là CSS thuần — không thêm một request ảnh nào, và chúng
                lấy màu từ token nên đổi bảng màu không phải sửa gì ở đây.
            */}
            <div
                aria-hidden
                className="text-foreground pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                    backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
                    backgroundSize: '22px 22px',
                }}
            />
            <div
                aria-hidden
                className="bg-primary/25 pointer-events-none absolute -top-40 -left-40 size-128 rounded-full blur-3xl"
            />
            <div
                aria-hidden
                className="bg-accent/40 pointer-events-none absolute -right-40 -bottom-40 size-128 rounded-full blur-3xl"
            />

            {/* `gap-0 p-0` để hai nửa chạm sát mép — mặc định Card có padding dọc. */}
            <Card className="relative w-full max-w-4xl gap-0 p-0 shadow-xl">
                <div className="grid md:grid-cols-2">
                    {/* ─── Nửa thương hiệu, ẩn trên màn hình hẹp ──────────────── */}
                    <aside className="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden p-8 md:flex">
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 opacity-15"
                            style={{
                                backgroundImage:
                                    'radial-gradient(currentColor 1px, transparent 1px)',
                                backgroundSize: '16px 16px',
                            }}
                        />
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-20 blur-3xl"
                            style={{
                                background: 'radial-gradient(circle, white, transparent 70%)',
                            }}
                        />

                        <div className="relative flex items-center gap-2.5">
                            <div className="bg-primary-foreground/15 flex size-9 items-center justify-center rounded-xl">
                                <HugeiconsIcon
                                    icon={StudentIcon}
                                    strokeWidth={2}
                                    className="size-5"
                                />
                            </div>
                            <span className="font-heading text-lg font-medium">Lernumi</span>
                        </div>

                        <div className="relative flex flex-col gap-7 py-10">
                            <p className="font-heading text-2xl leading-snug font-medium">
                                Not just the finished work — how it came to be.
                            </p>

                            <ul className="flex flex-col gap-5">
                                {HIGHLIGHTS.map((item) => (
                                    <li key={item.title} className="flex gap-3">
                                        <div className="bg-primary-foreground/15 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                                            <HugeiconsIcon
                                                icon={item.icon}
                                                strokeWidth={2}
                                                className="size-4"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">
                                                {item.title}
                                            </span>
                                            <span className="text-primary-foreground/70 text-sm">
                                                {item.description}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <p className="text-primary-foreground/60 relative text-xs">
                            A learning platform for any institution
                        </p>
                    </aside>

                    {/* ─── Nửa biểu mẫu ───────────────────────────────────────── */}
                    <div className="flex flex-col gap-7 p-8">
                        {/* Nhận diện thu gọn — thay cho nửa trái khi màn hình hẹp. */}
                        <div className="flex items-center gap-2.5 md:hidden">
                            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
                                <HugeiconsIcon
                                    icon={StudentIcon}
                                    strokeWidth={2}
                                    className="size-5"
                                />
                            </div>
                            <span className="font-heading text-lg font-medium">Lernumi</span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <h1 className="font-heading text-2xl font-medium tracking-tight">
                                Get started
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                Sign in to continue, or create a new account.
                            </p>
                        </div>

                        <Tabs defaultValue="sign-in">
                            <TabsList className="w-full">
                                <TabsTrigger value="sign-in" className="flex-1">
                                    Sign in
                                </TabsTrigger>
                                <TabsTrigger value="sign-up" className="flex-1">
                                    Sign up
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="sign-in" className="pt-6">
                                <SignInForm />
                            </TabsContent>

                            <TabsContent value="sign-up" className="pt-6">
                                <SignUpForm />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </Card>
        </div>
    );
}


import { HugeiconsIcon } from '@hugeicons/react';
import {
    Calendar03Icon,
    Leaf01Icon,
    SourceCodeIcon,
    TimeQuarterPassIcon,
    WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons';

import { BrandLogo } from '@/components/brand-logo';
import { Reveal } from '@/components/reveal';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Trang giới thiệu — cửa vào của người chưa biết đây là gì.
 *
 * ─── Vì sao nằm ở gốc, ngoài mọi khung ───────────────────────────────────────
 *
 * Nó chỉ nhận `app/layout.tsx`: không sidebar, không thanh tài khoản. Người chưa đăng nhập không
 * có gì để điều hướng, và một sidebar toàn liên kết họ chưa vào được thì chỉ gây bối rối.
 *
 * Phần ứng dụng thật nằm dưới `/navigation/…`, có sidebar riêng.
 *
 * ─── Vì sao mọi nút đều trỏ về `/auth` ───────────────────────────────────────
 *
 * Trang này KHÔNG tự hỏi "người dùng đăng nhập chưa". Không cần: `proxy.ts` đã đá người có phiên
 * từ `/auth` thẳng vào bảng điều khiển. Nên cùng một liên kết phục vụ được cả hai phía — người
 * mới thấy biểu mẫu đăng ký, người cũ đi thẳng vào ứng dụng — mà trang giới thiệu vẫn tĩnh hoàn
 * toàn, không đọc cookie, không truy vấn gì.
 *
 * ─── Vì sao không có nút đổi giao diện sáng/tối ──────────────────────────────
 *
 * Bản base44 có, nhưng nó cần một provider giữ lựa chọn của người dùng — thứ dự án chưa dựng.
 * Hiện trang đi theo cài đặt của hệ điều hành.
 */

const FEATURES = [
    {
        icon: SourceCodeIcon,
        title: 'Work in real tools',
        body: 'Code and diagram inside the platform — no juggling exports or screenshots.',
        wash: 'bg-brand-teal/12',
        ink: 'text-brand-teal',
        edge: 'hover:border-brand-teal/50',
    },
    {
        icon: Calendar03Icon,
        title: 'Keep study organised',
        body: 'One planner for assessment deadlines, class events and your own schedule.',
        wash: 'bg-brand-violet/12',
        ink: 'text-brand-violet',
        edge: 'hover:border-brand-violet/50',
    },
    {
        icon: TimeQuarterPassIcon,
        title: 'Show how your work developed',
        body: 'Your working process is recorded as structured steps you can be proud of.',
        wash: 'bg-brand-amber/12',
        ink: 'text-brand-amber',
        edge: 'hover:border-brand-amber/50',
    },
] as const;

/** Các chặng của một bài làm, hiện ra lần lượt để gợi ý rằng chúng là một dòng thời gian. */
const STEPS = [
    { label: 'Start', ink: 'text-brand-teal', edge: 'border-brand-teal/40' },
    { label: 'Edit', ink: 'text-brand-sky', edge: 'border-brand-sky/40' },
    { label: 'Save', ink: 'text-brand-violet', edge: 'border-brand-violet/40' },
    { label: 'Review', ink: 'text-brand-amber', edge: 'border-brand-amber/40' },
    { label: 'Submit', ink: 'text-brand-teal', edge: 'border-brand-teal/40' },
] as const;

const NAV_LINKS = [
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#tools', label: 'Tools' },
] as const;

export default function LandingPage() {
    return (
        <div className="bg-background text-foreground min-h-svh overflow-x-hidden">
            {/* ─── Đầu trang, dính trên cùng ──────────────────────────────── */}
            <header className="bg-background/80 border-border/60 fixed inset-x-0 top-0 z-50 border-b backdrop-blur">
                <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
                    <Link href="/" className="flex items-center gap-3">
                        <BrandLogo className="size-10" gradientId="ailearn-mark-header" />
                        <span className="font-heading text-xl font-semibold tracking-tight">
                            AI-<span className="text-brand-teal">Learn</span>
                        </span>
                    </Link>

                    <nav className="text-muted-foreground hidden items-center gap-8 text-sm md:flex">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                className="hover:text-foreground transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        {/* <Link
                            href="/auth"
                            className={buttonVariants({
                                variant: 'ghost',
                                size: 'lg',
                                className: 'hidden sm:inline-flex',
                            })}
                        >
                            Sign in
                        </Link> */}
                        <Link href="/auth" className={buttonVariants({ size: 'lg' })}>
                            Start learning
                        </Link>
                    </div>
                </div>
            </header>

            {/* ─── Hero ───────────────────────────────────────────────────── */}
            <section className="relative flex min-h-160 items-center overflow-hidden">
                {/*
                    Nền trang trí, toàn bộ bằng CSS. Bản base44 đặt một tấm ảnh sinh bởi AI ở đây
                    rồi phủ nền lên 88% — gần như không còn nhìn thấy ảnh. Bỏ ảnh đi thì trang nhẹ
                    hơn, không phụ thuộc CDN của họ, mà nhìn không khác là bao.
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
                    className="bg-brand-violet pointer-events-none absolute -top-32 -left-24 size-130 rounded-full opacity-30 blur-3xl"
                />
                <div
                    aria-hidden
                    className="bg-brand-teal pointer-events-none absolute -bottom-40 left-[18%] size-115 rounded-full opacity-25 blur-3xl"
                />
                {/* Làm nhạt dần hai đầu để hero nối liền với phần dưới thay vì cắt ngang. */}
                <div
                    aria-hidden
                    className="from-background via-background/40 to-background pointer-events-none absolute inset-0 bg-linear-to-b"
                />

                <div className="relative mx-auto w-full max-w-7xl px-5 pt-28 pb-16 md:px-8">
                    <div className="mx-auto flex max-w-215 flex-col items-center text-center">
                        <Reveal variant="blur">
                            <p className="border-brand-teal/40 bg-brand-teal/10 text-brand-teal mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide uppercase">
                                Learning, made visible
                            </p>
                        </Reveal>

                        <Reveal variant="up" delay={0.1}>
                            <h1 className="font-heading mb-7 text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl lg:text-7xl">
                                Build skills.{' '}
                                <span className="from-brand-teal via-brand-sky to-brand-violet bg-linear-to-r bg-clip-text text-transparent">
                                    Show your thinking.
                                </span>
                            </h1>
                        </Reveal>

                        <Reveal variant="up" delay={0.2}>
                            <p className="text-muted-foreground mx-auto mb-9 max-w-[60ch] text-lg leading-relaxed md:text-xl">
                                Work in real coding and diagram tools, organise every deadline, and
                                keep a clear record of how your work develops.
                            </p>
                        </Reveal>

                        <Reveal variant="up" delay={0.3}>
                            <div className="flex flex-wrap justify-center gap-3">
                                <Link
                                    href="/auth"
                                    className={buttonVariants({
                                        size: 'lg',
                                        className: 'shadow-primary/25 h-12 px-7 shadow-lg',
                                    })}
                                >
                                    Start learning
                                </Link>
                                <a
                                    href="#tools"
                                    className={buttonVariants({
                                        size: 'lg',
                                        variant: 'outline',
                                        className: 'h-12 px-7',
                                    })}
                                >
                                    Explore the tools
                                </a>
                            </div>
                            <p className="text-muted-foreground mt-8 text-sm">
                                Built for students and educators across institutions.
                            </p>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ─── Ba giá trị cốt lõi ─────────────────────────────────────── */}
            <section id="features" className="scroll-mt-20 py-20 md:py-28">
                <div className="mx-auto max-w-7xl px-5 md:px-8">
                    <div className="mx-auto mb-12 max-w-160 text-center">
                        <Reveal variant="blur">
                            <h2 className="font-heading mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                                Everything you need to learn, in one place
                            </h2>
                        </Reveal>
                        <Reveal variant="up" delay={0.1}>
                            <p className="text-muted-foreground leading-relaxed">
                                Real tools, a clear planner, and a record of how your work develops
                                — so students and educators can focus on what matters.
                            </p>
                        </Reveal>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {FEATURES.map((feature, index) => (
                            <Reveal
                                key={feature.title}
                                variant="up"
                                delay={index * 0.12}
                                className="h-full"
                            >
                                <div
                                    className={`bg-card border-border h-full rounded-2xl border p-6 transition-all hover:-translate-y-1.5 ${feature.edge}`}
                                >
                                    <div
                                        className={`mb-4 flex size-11 items-center justify-center rounded-xl ${feature.wash}`}
                                    >
                                        <HugeiconsIcon
                                            icon={feature.icon}
                                            strokeWidth={2}
                                            className={`size-5 ${feature.ink}`}
                                        />
                                    </div>
                                    <h3 className="font-heading mb-2 text-lg font-semibold">
                                        {feature.title}
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        {feature.body}
                                    </p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Phát lại ───────────────────────────────────────────────── */}
            <section
                id="how"
                className="bg-secondary/50 relative scroll-mt-20 overflow-hidden py-20 md:py-28"
            >
                <div
                    aria-hidden
                    className="bg-brand-sky pointer-events-none absolute top-1/2 -right-32 size-105 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
                />
                <div className="relative mx-auto max-w-7xl px-5 text-center md:px-8">
                    <Reveal variant="blur">
                        <h2 className="font-heading mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                            Replay the journey, not just the result
                        </h2>
                    </Reveal>
                    <Reveal variant="up" delay={0.1}>
                        <p className="text-muted-foreground mx-auto mb-12 max-w-[60ch]">
                            Educators can replay how a submission developed over time — a review of
                            the learning process, with clear indicators of moments worth a closer
                            look.
                        </p>
                    </Reveal>

                    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
                        {STEPS.map((step, index) => (
                            <div key={step.label} className="flex items-center gap-2 md:gap-4">
                                <Reveal variant="scale" delay={index * 0.1}>
                                    <div
                                        className={`bg-card rounded-full border px-4 py-2 text-sm font-semibold ${step.edge} ${step.ink}`}
                                    >
                                        {step.label}
                                    </div>
                                </Reveal>
                                {index < STEPS.length - 1 && (
                                    <span
                                        aria-hidden
                                        className="from-brand-teal to-brand-violet h-px w-6 bg-linear-to-r"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Hai công cụ ────────────────────────────────────────────── */}
            <section id="tools" className="scroll-mt-20 py-20 md:py-28">
                <div className="mx-auto max-w-7xl px-5 md:px-8">
                    <Reveal variant="blur">
                        <h2 className="font-heading mb-12 text-center text-3xl font-bold tracking-tight md:text-4xl">
                            The tools you actually use
                        </h2>
                    </Reveal>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Reveal variant="left" className="h-full">
                            <div className="bg-card border-border hover:border-brand-sky/50 relative h-full overflow-hidden rounded-2xl border p-8 transition-colors">
                                <div
                                    aria-hidden
                                    className="bg-brand-sky pointer-events-none absolute -top-16 -right-16 size-48 rounded-full opacity-20 blur-2xl"
                                />
                                <HugeiconsIcon
                                    icon={SourceCodeIcon}
                                    strokeWidth={2}
                                    className="text-brand-sky relative mb-4 size-8"
                                />
                                <h3 className="font-heading relative mb-2 text-xl font-semibold">
                                    Code Workspace
                                </h3>
                                <p className="text-muted-foreground relative text-sm leading-relaxed">
                                    Write, edit and save code with every step recorded — edits,
                                    pastes and saves become a replayable history.
                                </p>
                            </div>
                        </Reveal>

                        <Reveal variant="right" className="h-full">
                            <div className="bg-card border-border hover:border-brand-violet/50 relative h-full overflow-hidden rounded-2xl border p-8 transition-colors">
                                <div
                                    aria-hidden
                                    className="bg-brand-violet pointer-events-none absolute -top-16 -right-16 size-48 rounded-full opacity-20 blur-2xl"
                                />
                                <HugeiconsIcon
                                    icon={WorkflowSquare01Icon}
                                    strokeWidth={2}
                                    className="text-brand-violet relative mb-4 size-8"
                                />
                                <h3 className="font-heading relative mb-2 text-xl font-semibold">
                                    Diagram Workspace
                                </h3>
                                <p className="text-muted-foreground relative text-sm leading-relaxed">
                                    Build flowcharts and system diagrams with a node library, typed
                                    connections and a full activity history.
                                </p>
                            </div>
                        </Reveal>
                    </div>

                    <Reveal variant="up" delay={0.1}>
                        <div className="bg-card border-border hover:border-brand-teal/50 mt-6 flex flex-col items-start gap-6 rounded-2xl border p-8 transition-colors md:flex-row">
                            <div className="bg-brand-teal/12 flex size-11 shrink-0 items-center justify-center rounded-xl">
                                <HugeiconsIcon
                                    icon={Leaf01Icon}
                                    strokeWidth={2}
                                    className="text-brand-teal size-5"
                                />
                            </div>
                            <div>
                                <h3 className="font-heading mb-2 text-xl font-semibold">
                                    Map systems, not just boxes.
                                </h3>
                                <p className="text-muted-foreground max-w-[70ch] text-sm leading-relaxed">
                                    The diagram tool includes a sustainability node library — solar
                                    panels, batteries, smart meters, buildings and typed flows for
                                    electricity, water, data and emissions — so students can model
                                    real systems in project-based learning.
                                </p>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ─── Lời mời cuối ───────────────────────────────────────────── */}
            <section className="py-20 md:py-28">
                <div className="mx-auto max-w-7xl px-5 md:px-8">
                    <Reveal variant="scale">
                        <div className="border-border relative overflow-hidden rounded-3xl border px-6 py-16 text-center">
                            <div
                                aria-hidden
                                className="from-brand-teal/12 via-brand-sky/10 to-brand-violet/16 absolute inset-0 bg-linear-to-br"
                            />
                            <div className="relative">
                                <h2 className="font-heading mb-6 text-3xl font-bold tracking-tight md:text-4xl">
                                    Make your learning visible.
                                </h2>
                                <Link
                                    href="/auth"
                                    className={buttonVariants({
                                        size: 'lg',
                                        className: 'shadow-primary/25 h-12 px-8 shadow-lg',
                                    })}
                                >
                                    Start learning
                                </Link>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            <footer className="border-border text-muted-foreground flex flex-col items-center gap-3 border-t py-8 text-sm">
                <BrandLogo className="size-7" gradientId="ailearn-mark-footer" />
                <p>AI-Learn — make learning visible.</p>
            </footer>
        </div>
    );
}

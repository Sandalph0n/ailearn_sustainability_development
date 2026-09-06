import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowRight01Icon,
    BookOpen01Icon,
    Calendar03Icon,
    Note01Icon,
    SourceCodeIcon,
    TaskDone01Icon,
    TimeQuarterPassIcon,
    WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons';

import { BrandLogo } from '@/components/brand-logo';
import { DotGrid, Glow } from '@/components/navigation/decor';
import { buttonVariants } from '@/components/ui/button';
import { AccessPicker } from '@/components/navigation/access-picker';
import { getCurrentSession } from '@/lib/auth/session/service';
import { resolveActiveContext } from '@/lib/context/active-context';
import { db } from '@/lib/db';

/**
 * Bảng điều khiển.
 *
 * ─── Trang này được TRANG TRÍ, không phải thêm dữ liệu ───────────────────────
 *
 * Cấu trúc và các con số y như trước: bốn ô thống kê đọc thật từ database, hai khối trạng thái,
 * hai thẻ công cụ. Thay đổi nằm hoàn toàn ở lớp nhìn.
 *
 * ─── Bốn màu, và mỗi màu có việc của nó ──────────────────────────────────────
 *
 *     teal    môn học        — màu chính, dùng cho thứ nền tảng nhất
 *     amber   hạn nộp        — màu duy nhất mang tính cảnh báo
 *     sky     phiên ghi lại  — công cụ code
 *     violet  ghi chú        — công cụ sơ đồ
 *
 * Gán cố định như vậy để màu trở thành thông tin: nhìn thấy hổ phách là biết đang nói về thời
 * hạn, ở bất kỳ đâu trong ứng dụng. Nếu xoay vòng màu cho đẹp thì nó chỉ còn là trang trí.
 *
 * ─── Hoạ tiết: hai tầng, và MỘT gradient duy nhất ────────────────────────────
 *
 *     Glow      quầng sáng loang, rất mờ — chiều sâu cho nền
 *     DotGrid   lưới chấm đều, gần như không thấy — kết cấu
 *
 * Gradient chỉ xuất hiện ở dải chào, đúng một lần. Đổ gradient lên mọi bề mặt là một trong
 * những dấu hiệu bị nhận diện nhiều nhất của giao diện do máy sinh; các thẻ số dùng một vạch
 * màu đặc ở mép trái thay thế.
 *
 * Cũng không có chuyển động trang trí. Chuyển động chỉ nên dùng khi nó nói lên trạng thái hoặc
 * dẫn mắt; những chấm nhấp nháy trước đó không làm cả hai việc.
 */
export const dynamic = 'force-dynamic';

const TOOLS = [
    {
        href: '/tools/code',
        icon: SourceCodeIcon,
        title: 'Code Workspace',
        body: 'Write and run code with every edit, paste and save recorded in order.',
        ink: 'text-brand-sky',
        glow: 'bg-brand-sky',
        edge: 'hover:border-brand-sky/45',
    },
    {
        href: '/tools/diagram',
        icon: WorkflowSquare01Icon,
        title: 'Diagram Workspace',
        body: 'Build flowcharts and system diagrams from a typed node library.',
        ink: 'text-brand-violet',
        glow: 'bg-brand-violet',
        edge: 'hover:border-brand-violet/45',
    },
] as const;

export default async function DashboardPage({
    searchParams,
}: PageProps<'/navigation/dashboard'>) {
    const session = await getCurrentSession();
    const userId = session?.user.id;

    /**
     * Ngữ cảnh giải ra Ở ĐÂY, không ở layout: layout của App Router không nhận `searchParams`.
     * Trang tự đối chiếu URL với database rồi mới truy vấn — xem `lib/context/active-context`.
     */
    const { active, options, corrected } = userId
        ? await resolveActiveContext(userId, await searchParams)
        : { active: null, options: [], corrected: false };

    /**
     * Bộ lọc lượt mở môn suy ra TỪ ngữ cảnh, không từ tham số URL thô.
     *
     * Vai trò phạm vi OFFERING chỉ nhìn thấy đúng lượt mở đó. Vai trò cấp cơ sở nhìn mọi lượt mở
     * mà người này có chân, trong đúng cơ sở đang chọn. Không có ngữ cảnh thì không lọc gì —
     * người chưa được cấp vai trò nào vẫn thấy được phần cá nhân của mình.
     */
    const offeringScope = active
        ? active.role.scopeType === 'OFFERING'
            ? active.offering
                ? { id: active.offering.id }
                : { id: { in: [] as string[] } }
            : {
                  subject: { institutionId: active.institution.id },
                  scopeAssignments: {
                      some: { roleAssignment: { userId, roleRevokedAt: null } },
                  },
              }
        : undefined;

    const [enrolled, dueSoon, attempts, notes] = await Promise.all([
        db.scopeAssignment.count({
            where: {
                roleAssignment: {
                    userId,
                    roleRevokedAt: null,
                    ...(active ? { role: { institutionId: active.institution.id } } : {}),
                },
            },
        }),
        db.assessment.count({
            where: {
                dueAt: { gt: new Date() },
                offering: offeringScope ?? {
                    scopeAssignments: {
                        some: { roleAssignment: { userId, roleRevokedAt: null } },
                    },
                },
            },
        }),
        db.assessmentAttempt.count({
            where: {
                userId,
                ...(offeringScope ? { assessment: { offering: offeringScope } } : {}),
            },
        }),
        // Workspace cá nhân KHÔNG thuộc cơ sở nào — đổi vai trò không đổi con số này.
        db.personalWorkspace.count({ where: { userId } }),
    ]);

    const stats = [
        {
            label: 'Subjects',
            value: enrolled,
            caption: 'running this term',
            icon: BookOpen01Icon,
            ink: 'text-brand-teal',
            chip: 'bg-brand-teal/12',
            bar: 'bg-brand-teal',
            edge: 'hover:border-brand-teal/45',
        },
        {
            label: 'Due soon',
            value: dueSoon,
            caption: 'assessments ahead',
            icon: TaskDone01Icon,
            ink: 'text-brand-amber',
            chip: 'bg-brand-amber/12',
            bar: 'bg-brand-amber',
            edge: 'hover:border-brand-amber/45',
        },
        {
            label: 'Sessions',
            value: attempts,
            caption: 'recorded, replayable',
            icon: TimeQuarterPassIcon,
            ink: 'text-brand-sky',
            chip: 'bg-brand-sky/12',
            bar: 'bg-brand-sky',
            edge: 'hover:border-brand-sky/45',
        },
        {
            label: 'Notes',
            value: notes,
            caption: 'personal workspaces',
            icon: Note01Icon,
            ink: 'text-brand-violet',
            chip: 'bg-brand-violet/12',
            bar: 'bg-brand-violet',
            edge: 'hover:border-brand-violet/45',
        },
    ];

    return (
        <div className="flex flex-col gap-6 pt-1">
            {/* ─── Lời chào ───────────────────────────────────────────────── */}
            <section className="relative overflow-hidden rounded-xl border p-6 md:p-8">
                {/* Ba màu chuyển vào nhau — cả bảng màu thương hiệu xuất hiện một lần, rất nhạt. */}
                <div
                    aria-hidden
                    className="from-brand-teal/18 via-brand-sky/10 to-brand-violet/18 absolute inset-0 bg-linear-120"
                />
                <DotGrid opacity={0.06} size={18} />
                <Glow
                    className="-top-28 -right-20 size-72"
                    color="bg-brand-teal"
                    opacity="opacity-25"
                />
                <Glow
                    className="-bottom-32 left-1/3 size-64"
                    color="bg-brand-violet"
                    opacity="opacity-15"
                />

                {/*
                    Logo cỡ lớn làm hình chìm ở góc. Nó bị cắt bởi mép thẻ nên đọc như hoa văn
                    chứ không phải một logo đặt sai chỗ.
                */}
                <BrandLogo
                    className="pointer-events-none absolute -top-8 -right-6 hidden size-44 opacity-[0.07] md:block"
                    gradientId="ailearn-mark-dashboard"
                />

                <div className="relative flex flex-col gap-2">
                    <p className="text-brand-teal border-brand-teal/30 bg-brand-teal/10 inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">
                        {new Date().toLocaleDateString('en-AU', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                        })}
                    </p>
                    <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
                        {/*
                            Tên người dùng tô MỘT màu đặc, không phải gradient. Chữ tiêu đề đổ
                            gradient là dấu hiệu bị nhận diện mạnh nhất của giao diện máy sinh —
                            gần như không thương hiệu thật nào làm vậy trên chữ đang chạy.
                        */}
                        {session ? (
                            <>
                                Welcome back,{' '}
                                <span className="text-brand-teal">{session.user.firstName}</span>.
                            </>
                        ) : (
                            'Welcome back.'
                        )}
                    </h1>
                    <p className="text-muted-foreground max-w-xl text-sm">
                        Everything you do in a tool here is kept in order, so the whole session can
                        be replayed later.
                    </p>

                    {/*
                        Vai trò đang giữ, nhắc lại ngay trong dải chào. Bộ chọn trên header nói
                        cùng điều đó nhưng ở cỡ nhỏ và nằm ngoài luồng đọc; nhầm vai trò là nhìn
                        nhầm dữ liệu, nên nó đáng được nói hai lần.
                    */}
                    {active && (
                        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            Working as
                            <span className="text-brand-teal border-brand-teal/30 bg-brand-teal/10 rounded-md border px-2 py-0.5 text-xs font-semibold">
                                {active.role.roleName}
                            </span>
                            at {active.institution.name}
                            {active.offering && (
                                <span className="text-brand-sky border-brand-sky/30 bg-brand-sky/10 rounded-md border px-2 py-0.5 text-xs font-semibold">
                                    {active.offering.subjectCode}
                                </span>
                            )}
                        </p>
                    )}
                </div>
            </section>

            <AccessPicker options={options} active={active} corrected={corrected} />

            {/* ─── Bốn con số ─────────────────────────────────────────────── */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className={`bg-card relative overflow-hidden rounded-lg border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${stat.edge}`}
                    >
                        {/*
                            Thẻ số dùng MỘT vạch màu ở mép trái, không phải nền gradient. Gradient
                            lặp trên mọi bề mặt là dấu hiệu bị nhận diện; một vạch đặc thì nói cùng
                            một điều — "ô này thuộc nhóm màu nào" — mà không góp vào cái tell đó.
                        */}
                        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${stat.bar}`} />

                        <div className="relative">
                            <div
                                className={`flex size-9 items-center justify-center rounded-xl ${stat.chip}`}
                            >
                                <HugeiconsIcon
                                    icon={stat.icon}
                                    strokeWidth={2}
                                    className={`size-4 ${stat.ink}`}
                                />
                            </div>

                            {/*
                                Số lớn dùng chữ số tỉ lệ mặc định, KHÔNG `tabular-nums`: chữ số
                                đều bề rộng khiến số nhỏ trông rời rạc ở cỡ lớn. Dạng bảng chỉ
                                dành cho những cột số cần thẳng hàng dọc.
                            */}
                            <p className="font-heading mt-4 text-3xl font-semibold">{stat.value}</p>
                            <p className="mt-0.5 text-sm font-medium">{stat.label}</p>
                            <p className="text-muted-foreground text-xs">{stat.caption}</p>
                        </div>
                    </div>
                ))}
            </section>

            {/* ─── Hai khối trạng thái ────────────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3">
                <PanelCard
                    className="lg:col-span-2"
                    icon={Calendar03Icon}
                    title="Up next"
                    ink="text-brand-amber"
                    chip="bg-brand-amber/12"
                    glow="bg-brand-amber"
                >
                    <EmptyBlock
                        icon={Calendar03Icon}
                        ink="text-brand-amber"
                        chip="bg-brand-amber/10"
                        title="Nothing due yet"
                        body="Assessment deadlines appear here once you are enrolled in a subject that is running."
                    />
                </PanelCard>

                <PanelCard
                    icon={TimeQuarterPassIcon}
                    title="Recent work"
                    ink="text-brand-sky"
                    chip="bg-brand-sky/12"
                    glow="bg-brand-sky"
                >
                    <EmptyBlock
                        icon={TimeQuarterPassIcon}
                        ink="text-brand-sky"
                        chip="bg-brand-sky/10"
                        title="No sessions yet"
                        body="Open a tool and start working. Each session shows up here, ready to replay."
                    />
                </PanelCard>
            </div>

            {/* ─── Công cụ ────────────────────────────────────────────────── */}
            <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                    {/* Thanh gạch nhỏ có màu — dấu hiệu mở đầu một mục, thay cho chữ in đậm trơn. */}
                    <span
                        aria-hidden
                        className="bg-brand-sky h-4 w-1 rounded-xs"
                    />
                    <h2 className="font-heading text-lg font-medium">Your tools</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {TOOLS.map((tool) => (
                        <Link
                            key={tool.href}
                            href={tool.href}
                            className={`bg-card group relative overflow-hidden rounded-lg border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md ${tool.edge}`}
                        >
                            {/* Dùng lại `Glow` thay vì tự viết một div nữa — cùng hoạ tiết thì
                                nên cùng một chỗ định nghĩa, để độ mờ không trôi mỗi nơi một kiểu. */}
                            <Glow
                                className="-top-16 -right-12 size-40"
                                color={tool.glow}
                                opacity="opacity-20"
                            />
                            <DotGrid opacity={0.04} size={16} />

                            <div className="relative">
                                <HugeiconsIcon
                                    icon={tool.icon}
                                    strokeWidth={2}
                                    className={`mb-4 size-7 ${tool.ink}`}
                                />
                                <h3 className="font-heading mb-1.5 font-semibold">{tool.title}</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {tool.body}
                                </p>
                                <span className="text-muted-foreground group-hover:text-foreground mt-4 inline-flex items-center gap-1 text-sm transition-colors">
                                    Open
                                    <HugeiconsIcon
                                        icon={ArrowRight01Icon}
                                        strokeWidth={2}
                                        className="size-4 transition-transform group-hover:translate-x-0.5"
                                    />
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <section>
                <Link
                    href="/navigation/calendar"
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                    <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
                    Open the calendar
                </Link>
            </section>
        </div>
    );
}

/** Thẻ có tiêu đề kèm biểu tượng màu và một quầng sáng ở góc. */
function PanelCard({
    icon,
    title,
    ink,
    chip,
    glow,
    className = '',
    children,
}: {
    icon: typeof Calendar03Icon;
    title: string;
    ink: string;
    chip: string;
    glow: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <section className={`bg-card relative overflow-hidden rounded-lg border ${className}`}>
            <Glow className="-top-20 -right-16 size-40" color={glow} opacity="opacity-15" />

            <div className="relative flex items-center gap-2.5 px-5 pt-5 pb-3">
                <div className={`flex size-8 items-center justify-center rounded-lg ${chip}`}>
                    <HugeiconsIcon icon={icon} strokeWidth={2} className={`size-4 ${ink}`} />
                </div>
                <h2 className="font-heading font-semibold">{title}</h2>
            </div>

            <div className="relative px-5 pb-5">{children}</div>
        </section>
    );
}

/**
 * Trạng thái rỗng.
 *
 * Nói rõ khối này SẼ chứa gì và CẦN gì để có dữ liệu, thay vì một chữ "No data" cụt lủn. Người
 * dùng mới đăng ký gặp màn hình này trước tiên, nên nó đáng được vẽ tử tế: biểu tượng có màu
 * trong một vòng tròn nhạt, viền đứt, chữ căn giữa.
 */
function EmptyBlock({
    icon,
    ink,
    chip,
    title,
    body,
}: {
    icon: typeof Calendar03Icon;
    ink: string;
    chip: string;
    title: string;
    body: string;
}) {
    return (
        <div className="border-border/70 flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
            <div className={`mb-1 flex size-11 items-center justify-center rounded-lg ${chip}`}>
                <HugeiconsIcon icon={icon} strokeWidth={2} className={`size-5 ${ink}`} />
            </div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-muted-foreground max-w-sm text-sm">{body}</p>
        </div>
    );
}

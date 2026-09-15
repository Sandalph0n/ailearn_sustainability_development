'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AssessmentPlanDto } from '@/lib/calendar/plan-schema';
import { cn } from '@/lib/utils';

import type { CalendarAssessment, CalendarOffering, CalendarTerm } from './types';
import { reportError } from './week-events';
import { addDays, dayKeyOf, diffDays, formatDay, weekIndexOf, type DayKey, type TermWeek } from './weeks';

/**
 * Gantt cả kỳ. Mỗi môn một hàng; mỗi bài là một DẢI từ ngày người học định bắt đầu tới ngày định
 * xong — do chính họ đặt, không suy tự động. Bài chưa có kế hoạch chỉ hiện một mốc nhỏ ở ngày
 * nộp; bấm vào mốc (hoặc dải) để đặt/sửa khoảng ngày.
 *
 * Trục ngang chia theo NGÀY (vạch đứt mảnh trong mỗi cột tuần) nên dải bám đúng ngày, còn tiêu đề
 * cột vẫn là tuần học để đọc nhanh "Wk 8".
 */

const LANE_HEIGHT = 30;
const ROW_PADDING = 8;
const LABEL_COL = '9rem';
/** Bề ngang (tính bằng ngày) một mốc hạn nộp kèm tên bài chiếm trên trục. */
const MARK_LABEL_DAYS = 16;

type PlacedAssessment = CalendarAssessment & { offering: CalendarOffering };

const PERIOD_STYLE: Record<TermWeek['type'], { band: string; label: string }> = {
    TEACHING: { band: 'bg-brand-teal/10', label: 'Teaching' },
    BREAK: { band: 'bg-brand-amber/15', label: 'Recess' },
    EXAM: { band: 'bg-brand-violet/15', label: 'Exams' },
    GAP: { band: 'bg-muted/40', label: '' },
};

type Bar = {
    assessment: PlacedAssessment;
    /** Ngày đầu/cuối của dải (kế hoạch) — null nếu chưa có kế hoạch. */
    plan: { start: DayKey; end: DayKey } | null;
    /** Ngày nộp suy ra (ngày thật, hoặc Chủ nhật của "week N"). */
    dueDay: DayKey | null;
    lane: number;
};

/** Xếp các dải vào làn sao cho không đè nhau: dải nào cũng thử làn thấp nhất còn trống. */
function packLanes(items: Array<Omit<Bar, 'lane'> & { from: number; to: number }>): Bar[] {
    const laneEnds: number[] = [];
    return [...items]
        .sort((a, b) => a.from - b.from || a.to - b.to)
        .map((item) => {
            let lane = laneEnds.findIndex((end) => end < item.from);
            if (lane === -1) lane = laneEnds.length;
            laneEnds[lane] = item.to;
            return { assessment: item.assessment, plan: item.plan, dueDay: item.dueDay, lane };
        });
}

export function TermGantt({
    term,
    weeks,
    offerings,
    assessments,
    plans,
    onPlansChange,
    today,
    timeZone,
    focusMonday,
    onFocusWeek,
}: {
    term: CalendarTerm;
    weeks: TermWeek[];
    offerings: CalendarOffering[];
    assessments: PlacedAssessment[];
    plans: AssessmentPlanDto[];
    onPlansChange: (next: (current: AssessmentPlanDto[]) => AssessmentPlanDto[]) => void;
    today: DayKey;
    timeZone: string;
    focusMonday: DayKey;
    onFocusWeek: (week: TermWeek) => void;
}) {
    const [editing, setEditing] = useState<{ bar: Bar; anchor: DOMRect } | null>(null);

    const spanStart = weeks[0]?.start ?? today;
    const totalDays = Math.max(1, weeks.length * 7);
    const dayPercent = (key: DayKey) => (Math.max(0, Math.min(totalDays, diffDays(spanStart, key))) / totalDays) * 100;

    const planByAssessment = useMemo(
        () => new Map(plans.map((plan) => [plan.assessmentId, plan])),
        [plans],
    );

    // Hàng theo môn: dải + mốc, đã xếp làn.
    const rows = useMemo(
        () =>
            offerings.map((offering) => {
                const items = assessments
                    .filter((assessment) => assessment.offeringId === offering.id)
                    .map((assessment) => {
                        const plan = planByAssessment.get(assessment.id);
                        const weekIndex = weekIndexOf(assessment, weeks, timeZone);
                        const dueDay = assessment.dueAt
                            ? dayKeyOf(assessment.dueAt, timeZone)
                            : weekIndex !== null
                              ? weeks[weekIndex].end
                              : null;
                        const range = plan
                            ? { start: plan.startDate, end: plan.endDate }
                            : dueDay
                              ? { start: dueDay, end: dueDay }
                              : null;
                        if (!range) return null;
                        return {
                            assessment,
                            plan: plan ? { start: plan.startDate, end: plan.endDate } : null,
                            dueDay,
                            from: diffDays(spanStart, range.start),
                            // Mốc kèm nhãn chiếm cỡ 10 ngày, để hai mốc gần nhau xếp xuống làn dưới thay vì đè chữ.
                            to: plan ? diffDays(spanStart, range.end) : diffDays(spanStart, range.start) + MARK_LABEL_DAYS,
                        };
                    })
                    .filter((item): item is NonNullable<typeof item> => item !== null);
                const bars = packLanes(items);
                const unscheduled = assessments.filter(
                    (assessment) => assessment.offeringId === offering.id && !items.some((item) => item.assessment.id === assessment.id),
                );
                const lanes = Math.max(1, ...bars.map((bar) => bar.lane + 1));
                return { offering, bars, unscheduled, lanes };
            }),
        [assessments, offerings, planByAssessment, spanStart, timeZone, weeks],
    );

    // Tổng trọng số theo tuần nộp — hàng Overall, để nhìn ra tuần nào dồn bài.
    const weekTotals = weeks.map((_, index) =>
        assessments.reduce(
            (sum, assessment) => sum + (weekIndexOf(assessment, weeks, timeZone) === index ? assessment.weight : 0),
            0,
        ),
    );
    const heaviest = Math.max(...weekTotals, 1);
    const heat = (weight: number) =>
        weight > 0
            ? `color-mix(in oklab, var(--brand-teal) ${Math.round((0.18 + Math.min(weight / heaviest, 1) * 0.6) * 100)}%, transparent)`
            : undefined;

    const todayPercent =
        weeks.length > 0 && spanStart <= today && today <= weeks[weeks.length - 1].end
            ? ((diffDays(spanStart, today) + 0.5) / totalDays) * 100
            : null;

    const columns = `${LABEL_COL} repeat(${Math.max(weeks.length, 1)}, minmax(3.25rem, 1fr))`;

    const savePlan = async (assessmentId: string, startDate: DayKey, endDate: DayKey) => {
        const response = await fetch(`/api/me/assessment-plans/${assessmentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate }),
        });
        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.error?.message ?? 'Could not save the plan.');
        }
        const saved = { assessmentId, startDate, endDate };
        onPlansChange((current) => [...current.filter((plan) => plan.assessmentId !== assessmentId), saved]);
    };

    const removePlan = async (assessmentId: string) => {
        const response = await fetch(`/api/me/assessment-plans/${assessmentId}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) throw new Error('Could not remove the plan.');
        onPlansChange((current) => current.filter((plan) => plan.assessmentId !== assessmentId));
    };

    return (
        <section className="bg-card overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                    <h2 className="font-heading text-base font-semibold">
                        Session {term.session}, {term.year} at a glance
                    </h2>
                    <p className="text-muted-foreground text-xs">
                        Click an assessment to plan when you will work on it. Bars are your plan; small
                        marks are due dates.
                    </p>
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-[11px]">
                    {(['TEACHING', 'BREAK', 'EXAM'] as const).map((type) => (
                        <span key={type} className="flex items-center gap-1.5">
                            <span className={cn('inline-block size-3 rounded-sm border', PERIOD_STYLE[type].band)} />
                            {PERIOD_STYLE[type].label}
                        </span>
                    ))}
                    <span className="flex items-center gap-1.5">
                        <span className="bg-brand-teal inline-block h-3 w-5 rounded-[2px]" /> Planned
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="bg-brand-amber inline-block size-2.5 rotate-45" /> Due
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="bg-primary inline-block h-3 w-0.5" /> Today
                    </span>
                </div>
            </div>

            {weeks.length === 0 ? (
                <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                    This term has no teaching periods set up yet, so weeks cannot be drawn.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <div className="relative min-w-[56rem]" style={{ display: 'grid', gridTemplateColumns: columns }}>
                        {/* Tiêu đề tuần */}
                        <div className="bg-card sticky left-0 z-10 border-r border-b" />
                        {weeks.map((week) => (
                            <button
                                key={week.start}
                                type="button"
                                onClick={() => onFocusWeek(week)}
                                className={cn(
                                    'border-r border-b px-1 py-1.5 text-center transition-colors last:border-r-0',
                                    PERIOD_STYLE[week.type].band,
                                    week.start === focusMonday && 'ring-primary ring-2 ring-inset',
                                )}
                                title={`${formatDay(week.start, { day: 'numeric', month: 'short' })} – ${formatDay(week.end, { day: 'numeric', month: 'short' })}`}
                            >
                                <span className="block text-[11px] font-semibold">{week.label}</span>
                                <span className="text-muted-foreground block text-[10px]">
                                    {formatDay(week.start, { day: 'numeric', month: 'short' })}
                                </span>
                            </button>
                        ))}

                        {/* Hàng môn */}
                        {rows.map(({ offering, bars, unscheduled, lanes }) => {
                            const height = lanes * LANE_HEIGHT + ROW_PADDING * 2;
                            return (
                                <div key={offering.id} className="contents">
                                    <div className="bg-card sticky left-0 z-10 flex flex-col items-center justify-center border-r border-b px-3 py-2 text-center" style={{ height }}>
                                        <p className="text-xs font-semibold">{offering.subject.code}</p>
                                        <p className="text-muted-foreground max-w-full truncate text-[10px]">{offering.subject.name}</p>
                                        {unscheduled.length > 0 && (
                                            <p className="text-muted-foreground mt-1 max-w-full truncate text-[10px]">
                                                {unscheduled.length} without a date
                                            </p>
                                        )}
                                    </div>
                                    <div
                                        className="relative border-b"
                                        style={{ gridColumn: `2 / span ${weeks.length}`, height }}
                                    >
                                        <DayGrid weeks={weeks} />
                                        {bars.map((bar) => (
                                            <BarOrMark
                                                key={bar.assessment.id}
                                                bar={bar}
                                                dayPercent={dayPercent}
                                                totalDays={totalDays}
                                                onOpen={(anchor) => setEditing({ bar, anchor })}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Hàng tổng */}
                        <div className="bg-muted/40 sticky left-0 z-10 flex items-center justify-center border-t-2 border-r px-3 py-2 text-xs font-semibold">
                            Due weight
                        </div>
                        {weekTotals.map((total, index) => (
                            <div
                                key={`total-${index}`}
                                className="border-t-2 border-r py-2 text-center text-xs font-semibold tabular-nums last:border-r-0"
                                style={{ backgroundColor: heat(total) }}
                            >
                                {total > 0 ? `${Math.round(total)}%` : '·'}
                            </div>
                        ))}

                        {/* Vạch hôm nay */}
                        {todayPercent !== null && (
                            <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: LABEL_COL, right: 0 }}>
                                <div className="bg-primary absolute top-0 bottom-0 w-0.5 opacity-80" style={{ left: `${todayPercent}%` }} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {editing && (
                <PlanEditor
                    bar={editing.bar}
                    anchor={editing.anchor}
                    termStart={spanStart}
                    termEnd={weeks[weeks.length - 1]?.end ?? spanStart}
                    onSave={async (start, end) => {
                        try {
                            await savePlan(editing.bar.assessment.id, start, end);
                            setEditing(null);
                        } catch (error) {
                            reportError(error);
                        }
                    }}
                    onRemove={
                        editing.bar.plan
                            ? async () => {
                                  try {
                                      await removePlan(editing.bar.assessment.id);
                                      setEditing(null);
                                  } catch (error) {
                                      reportError(error);
                                  }
                              }
                            : undefined
                    }
                    onClose={() => setEditing(null)}
                />
            )}
        </section>
    );
}

/** Vạch ngày đứt mảnh trong từng tuần; ranh giới tuần là vạch liền. */
function DayGrid({ weeks }: { weeks: TermWeek[] }) {
    const total = weeks.length * 7;
    return (
        <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: total - 1 }, (_, index) => {
                const day = index + 1;
                return (
                    <span
                        key={day}
                        className={cn(
                            'absolute top-0 bottom-0 border-l',
                            day % 7 === 0 ? 'border-border' : 'border-border/60 border-dashed',
                        )}
                        style={{ left: `${(day / total) * 100}%` }}
                    />
                );
            })}
        </div>
    );
}

function BarOrMark({
    bar,
    dayPercent,
    totalDays,
    onOpen,
}: {
    bar: Bar;
    dayPercent: (key: DayKey) => number;
    totalDays: number;
    onOpen: (anchor: DOMRect) => void;
}) {
    const top = ROW_PADDING + bar.lane * LANE_HEIGHT;
    const label = `${bar.assessment.name} · ${bar.assessment.weight}%${bar.assessment.hurdle ? ' · hurdle' : ''}`;
    const open = (event: React.MouseEvent<HTMLElement>) => onOpen(event.currentTarget.getBoundingClientRect());

    if (bar.plan) {
        const left = dayPercent(bar.plan.start);
        const width = Math.max(100 / totalDays, dayPercent(addDays(bar.plan.end, 1)) - left);
        return (
            <>
                <button
                    type="button"
                    onClick={open}
                    title={`${label}\nPlanned ${formatDay(bar.plan.start, { day: 'numeric', month: 'short' })} – ${formatDay(bar.plan.end, { day: 'numeric', month: 'short' })}`}
                    className="bg-brand-teal hover:bg-brand-teal/90 focus-visible:ring-ring absolute flex h-6 items-center overflow-hidden rounded-[4px] px-2.5 text-left text-[11px] font-medium text-white shadow-sm outline-none focus-visible:ring-2"
                    style={{ top: top + 2, left: `${left}%`, width: `${width}%` }}
                >
                    <span className="truncate">{label}</span>
                </button>
                {bar.dueDay && (
                    <span
                        aria-hidden
                        className="bg-brand-amber absolute size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] shadow-sm"
                        style={{ top: top + 9, left: `calc(${dayPercent(bar.dueDay)}% + ${50 / totalDays}%)` }}
                    />
                )}
            </>
        );
    }

    if (!bar.dueDay) return null;
    const left = dayPercent(bar.dueDay) + 50 / totalDays;
    return (
        <button
            type="button"
            onClick={open}
            title={`${label}\nDue ${formatDay(bar.dueDay, { day: 'numeric', month: 'short' })} — click to plan`}
            className="hover:bg-accent group absolute flex h-6 -translate-x-1 items-center gap-1.5 rounded-md pr-2 pl-1 text-left text-[11px] outline-none focus-visible:ring-2"
            style={{ top: top + 2, left: `${left}%`, maxWidth: `${(MARK_LABEL_DAYS / totalDays) * 100}%` }}
        >
            <span className="bg-brand-amber inline-block size-2.5 shrink-0 rotate-45 rounded-[2px]" />
            <span className="text-foreground/80 truncate">{bar.assessment.name}</span>
        </button>
    );
}

function PlanEditor({
    bar,
    anchor,
    termStart,
    termEnd,
    onSave,
    onRemove,
    onClose,
}: {
    bar: Bar;
    anchor: DOMRect;
    termStart: DayKey;
    termEnd: DayKey;
    onSave: (start: DayKey, end: DayKey) => Promise<void>;
    onRemove?: () => Promise<void>;
    onClose: () => void;
}) {
    const due = bar.dueDay;
    const [start, setStart] = useState(bar.plan?.start ?? (due ? addDays(due, -13) : termStart));
    const [end, setEnd] = useState(bar.plan?.end ?? due ?? termStart);
    const [busy, setBusy] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDown = (event: PointerEvent) => {
            if (cardRef.current && !cardRef.current.contains(event.target as Node)) onClose();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        const timer = window.setTimeout(() => document.addEventListener('pointerdown', onDown), 0);
        document.addEventListener('keydown', onKey);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const width = 320;
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - width - 8);
    const top = anchor.bottom + 8 + 260 > window.innerHeight ? Math.max(8, anchor.top - 8 - 260) : anchor.bottom + 8;
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end;
    const days = valid ? diffDays(start, end) + 1 : 0;

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        try {
            await action();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            ref={cardRef}
            role="dialog"
            aria-label="Plan assessment"
            className="bg-popover text-popover-foreground fixed z-50 rounded-xl border p-4 shadow-lg"
            style={{ left, top, width }}
        >
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                {bar.assessment.offering.subject.code}
            </p>
            <Link href={bar.assessment.href} className="font-heading mt-0.5 block text-sm font-semibold hover:underline">
                {bar.assessment.name}
            </Link>
            <p className="text-muted-foreground mt-0.5 text-xs">
                {bar.assessment.weight}%{bar.assessment.hurdle ? ' · hurdle' : ''} ·{' '}
                {due ? `due ${formatDay(due, { weekday: 'short', day: 'numeric', month: 'short' })}` : bar.assessment.expectedDue || 'no due date'}
            </p>

            <form
                className="mt-3 space-y-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (valid) void run(() => onSave(start, end));
                }}
            >
                <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-xs font-medium">
                        Start working
                        <Input type="date" value={start} min={addDays(termStart, -60)} max={addDays(termEnd, 60)} onChange={(event) => setStart(event.target.value)} />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                        Finish by
                        <Input type="date" value={end} min={addDays(termStart, -60)} max={addDays(termEnd, 60)} onChange={(event) => setEnd(event.target.value)} />
                    </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {due &&
                        [7, 14, 21].map((span) => (
                            <Button
                                key={span}
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                    setStart(addDays(due, -(span - 1)));
                                    setEnd(due);
                                }}
                            >
                                {span} days before due
                            </Button>
                        ))}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-muted-foreground text-xs">{valid ? `${days} day${days === 1 ? '' : 's'}` : 'End must be after start'}</span>
                    <div className="flex gap-2">
                        {onRemove && (
                            <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void run(onRemove)}>
                                Remove
                            </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={!valid || busy}>
                            {busy ? 'Saving…' : bar.plan ? 'Save' : 'Plan'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}

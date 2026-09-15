'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { CalendarEventDto } from '@/lib/calendar/event-schema';
import type { AssessmentPlanDto } from '@/lib/calendar/plan-schema';
import { cn } from '@/lib/utils';

import type { CalendarAssessment, CalendarData, CalendarOffering, CalendarTerm } from './types';
import { TermGantt } from './term-gantt';
import {
    deleteEventRequest,
    EventBlock,
    EventEditor,
    reportError,
    saveEventRequest,
    useEventInteractions,
    type EditorState,
    type EventDraft,
} from './week-events';
import {
    addDays,
    buildTermWeeks,
    dayKeyOf,
    formatDay,
    localTimeOf,
    minutesOf,
    mondayOf,
    wallTimeToIso,
    weekDays,
    type DayKey,
    type TermWeek,
} from './weeks';

/**
 * Trang Calendar: nửa trên là tuần 7 ngày kiểu Google Calendar, nửa dưới là Gantt cả kỳ.
 *
 * Hai nửa dùng chung một "tuần đang xem": bấm cột tuần trên Gantt thì nửa trên nhảy tới tuần đó,
 * còn ‹ › ở nửa trên trượt theo từng tuần. Kỳ được chọn qua ô bên phải tiêu đề; mặc định là kỳ
 * chứa hôm nay, không có thì kỳ gần nhất.
 */

const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_HEIGHT = 44;
/** Cột nhãn giờ bên trái (3.5rem). */
const GUTTER_PX = 56;

type PlacedAssessment = CalendarAssessment & { offering: CalendarOffering };

const PERIOD_STYLE: Record<TermWeek['type'], { band: string; label: string }> = {
    TEACHING: { band: 'bg-brand-teal/10', label: 'Teaching' },
    BREAK: { band: 'bg-brand-amber/15', label: 'Recess' },
    EXAM: { band: 'bg-brand-violet/15', label: 'Exams' },
    GAP: { band: 'bg-muted/40', label: '' },
};

function termLabel(term: CalendarTerm): string {
    return `Session ${term.session}, ${term.year}`;
}

function termContaining(terms: CalendarTerm[], today: DayKey, timeZone: string): CalendarTerm | null {
    return (
        terms.find((term) =>
            term.periods.some(
                (period) =>
                    dayKeyOf(period.startAt, timeZone) <= today && today <= dayKeyOf(period.endAt, timeZone),
            ),
        ) ?? null
    );
}

/** Hạn 23:59 hay 00:00 nghĩa là "trong ngày" — hiện ở hàng all-day thay vì kẻ khối lúc nửa đêm. */
function isAllDay(assessment: CalendarAssessment, timeZone: string): boolean {
    if (!assessment.dueAt) return true;
    const { hour, minute } = localTimeOf(assessment.dueAt, timeZone);
    return (hour === 23 && minute >= 55) || (hour === 0 && minute === 0);
}

export function CalendarPlanner({
    data,
    today,
    initialEvents,
    initialPlans,
}: {
    data: CalendarData;
    today: DayKey;
    initialEvents: CalendarEventDto[];
    initialPlans: AssessmentPlanDto[];
}) {
    const { timeZone } = data;
    const [events, setEvents] = useState<CalendarEventDto[]>(initialEvents);
    const [plans, setPlans] = useState<AssessmentPlanDto[]>(initialPlans);
    const sortedTerms = useMemo(
        () => [...data.terms].sort((a, b) => b.year - a.year || b.session - a.session),
        [data.terms],
    );
    const [termId, setTermId] = useState<string | null>(
        () => (termContaining(sortedTerms, today, timeZone) ?? sortedTerms[0])?.id ?? null,
    );
    const term = sortedTerms.find((entry) => entry.id === termId) ?? null;
    const weeks = useMemo(() => (term ? buildTermWeeks(term, timeZone) : []), [term, timeZone]);

    const offerings = useMemo(
        () => data.offerings.filter((offering) => offering.termId === termId),
        [data.offerings, termId],
    );
    const placed = useMemo<PlacedAssessment[]>(
        () =>
            offerings.flatMap((offering) =>
                offering.assessments.map((assessment) => ({ ...assessment, offering })),
            ),
        [offerings],
    );

    // Tuần đang xem, ghi kèm kỳ: đổi kỳ thì lựa chọn cũ hết hiệu lực và quay về mặc định — hôm
    // nay nếu nằm trong kỳ, không thì tuần đầu kỳ.
    const [focus, setFocus] = useState<{ termId: string | null; monday: DayKey } | null>(null);
    const defaultMonday =
        weeks.some((week) => week.start === mondayOf(today)) || weeks.length === 0
            ? mondayOf(today)
            : weeks[0].start;
    const focusMonday = focus && focus.termId === termId ? focus.monday : defaultMonday;
    const setFocusMonday = (monday: DayKey) => setFocus({ termId, monday });

    if (!term) {
        return (
            <div className="bg-card rounded-xl border p-8 text-center">
                <p className="font-medium">No study term to show yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                    Your calendar fills in once you have access to a subject offering.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">
                    {offerings.length} subject{offerings.length === 1 ? '' : 's'} ·{' '}
                    {placed.length} assessment{placed.length === 1 ? '' : 's'}
                    {!data.canSeeAssessments && ' (this role cannot see assessments)'}
                </p>
                <Select
                    items={Object.fromEntries(sortedTerms.map((entry) => [entry.id, termLabel(entry)]))}
                    value={termId}
                    onValueChange={(next) => setTermId(next)}
                >
                    <SelectTrigger aria-label="Study term" className="w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {sortedTerms.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                                {termLabel(entry)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <WeekView
                monday={focusMonday}
                weeks={weeks}
                today={today}
                timeZone={timeZone}
                assessments={placed}
                offerings={offerings}
                events={events}
                onEventsChange={setEvents}
                onMove={(delta) => setFocusMonday(addDays(focusMonday, delta * 7))}
                onToday={() => setFocusMonday(mondayOf(today))}
            />

            <TermGantt
                term={term}
                weeks={weeks}
                offerings={offerings}
                assessments={placed}
                plans={plans}
                onPlansChange={setPlans}
                today={today}
                timeZone={timeZone}
                focusMonday={focusMonday}
                onFocusWeek={(week) => setFocusMonday(week.start)}
            />
        </div>
    );
}

// ─── Nửa trên: tuần 7 ngày ────────────────────────────────────────────────────

function WeekView({
    monday,
    weeks,
    today,
    timeZone,
    assessments,
    offerings,
    events,
    onEventsChange,
    onMove,
    onToday,
}: {
    monday: DayKey;
    weeks: TermWeek[];
    today: DayKey;
    timeZone: string;
    assessments: PlacedAssessment[];
    offerings: CalendarOffering[];
    events: CalendarEventDto[];
    onEventsChange: (next: (current: CalendarEventDto[]) => CalendarEventDto[]) => void;
    onMove: (delta: number) => void;
    onToday: () => void;
}) {
    const days = weekDays(monday);
    const termWeek = weeks.find((week) => week.start === monday) ?? null;
    const scrollRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const [editor, setEditor] = useState<{ state: EditorState; anchor: DOMRect | null } | null>(null);
    // Khung của khối vừa bấm — ghi lúc pointerdown, dùng lúc mở ô sửa.
    const pressedRectRef = useRef<DOMRect | null>(null);
    const [saving, setSaving] = useState(false);

    // Mở ra ở 8 giờ sáng thay vì 6 giờ, như Google Calendar cuộn sẵn tới giờ làm việc.
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: (8 - HOUR_START) * HOUR_HEIGHT - 10 });
    }, []);

    const offeringCode = (offeringId: string | null) =>
        offerings.find((offering) => offering.id === offeringId)?.subject.code ?? null;

    const eventsByDay = new Map<DayKey, CalendarEventDto[]>();
    for (const day of days) eventsByDay.set(day, []);
    for (const event of events) eventsByDay.get(dayKeyOf(event.startAt, timeZone))?.push(event);

    /** Khung màn hình của một khoảng giờ trong một cột — để đặt ô sửa cạnh khối vừa kéo ra. */
    const rectFor = (draft: EventDraft): DOMRect | null => {
        const grid = gridRef.current;
        if (!grid) return null;
        const rect = grid.getBoundingClientRect();
        const dayWidth = (rect.width - GUTTER_PX) / days.length;
        const index = Math.max(0, days.indexOf(draft.day));
        const top = rect.top + ((draft.startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
        const height = ((draft.endMin - draft.startMin) / 60) * HOUR_HEIGHT;
        return new DOMRect(rect.left + GUTTER_PX + index * dayWidth, top, dayWidth, height);
    };

    const persistMove = async (event: CalendarEventDto, draft: EventDraft) => {
        const previous = events;
        const optimistic: CalendarEventDto = {
            ...event,
            startAt: wallTimeToIso(draft.day, draft.startMin, timeZone),
            endAt: wallTimeToIso(draft.day, draft.endMin, timeZone),
        };
        onEventsChange((current) => current.map((entry) => (entry.id === event.id ? optimistic : entry)));
        try {
            const saved = await saveEventRequest(
                { id: event.id, title: event.title, note: event.note ?? '', ...draft, offeringId: event.offeringId },
                timeZone,
            );
            onEventsChange((current) => current.map((entry) => (entry.id === event.id ? saved : entry)));
        } catch (error) {
            onEventsChange(() => previous);
            reportError(error);
        }
    };

    const interactions = useEventInteractions({
        gridRef,
        days,
        hourStart: HOUR_START,
        hourEnd: HOUR_END,
        hourHeight: HOUR_HEIGHT,
        gutterPx: GUTTER_PX,
        timeZone,
        onOpenEditor: (state) => {
            setEditor({
                state,
                anchor: state.mode === 'create' ? rectFor(state.draft) : pressedRectRef.current,
            });
        },
        onMoveEvent: (event, draft) => void persistMove(event, draft),
    });

    const saveFromEditor = async (input: {
        title: string;
        note: string;
        day: DayKey;
        startMin: number;
        endMin: number;
        offeringId: string | null;
    }) => {
        if (!editor) return;
        const { state } = editor;
        setSaving(true);
        try {
            const saved = await saveEventRequest(
                { ...input, id: state.mode === 'edit' ? state.event.id : undefined },
                timeZone,
            );
            onEventsChange((current) =>
                state.mode === 'edit'
                    ? current.map((entry) => (entry.id === saved.id ? saved : entry))
                    : [...current, saved],
            );
            setEditor(null);
        } catch (error) {
            reportError(error);
        } finally {
            setSaving(false);
        }
    };

    const deleteFromEditor = async () => {
        if (editor?.state.mode !== 'edit') return;
        const target = editor.state.event;
        setSaving(true);
        try {
            await deleteEventRequest(target.id);
            onEventsChange((current) => current.filter((entry) => entry.id !== target.id));
            setEditor(null);
        } catch (error) {
            reportError(error);
        } finally {
            setSaving(false);
        }
    };

    const byDay = new Map<DayKey, { allDay: PlacedAssessment[]; timed: PlacedAssessment[] }>();
    for (const day of days) byDay.set(day, { allDay: [], timed: [] });
    for (const assessment of assessments) {
        if (!assessment.dueAt) continue;
        const key = dayKeyOf(assessment.dueAt, timeZone);
        const bucket = byDay.get(key);
        if (!bucket) continue;
        (isAllDay(assessment, timeZone) ? bucket.allDay : bucket.timed).push(assessment);
    }

    const rangeLabel = `${formatDay(days[0], { day: 'numeric', month: 'short' })} – ${formatDay(days[6], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })}`;

    return (
        <section className="bg-card overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-sm" aria-label="Previous week" onClick={() => onMove(-1)}>
                        <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={onToday}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon-sm" aria-label="Next week" onClick={() => onMove(1)}>
                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                    </Button>
                </div>
                <h2 className="font-heading text-base font-semibold">
                    {termWeek?.label === '—' || !termWeek ? 'Outside the study term' : termWeek.label.replace('Wk', 'Week')}
                    <span className="text-muted-foreground ml-2 text-sm font-normal">{rangeLabel}</span>
                </h2>
                {termWeek && termWeek.type !== 'GAP' && (
                    <Badge variant="outline" className="ml-auto">
                        {termWeek.periodName ?? PERIOD_STYLE[termWeek.type].label}
                    </Badge>
                )}
            </div>

            {/* Tiêu đề ngày + hàng all-day */}
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b">
                <div className="border-r" />
                {days.map((day) => {
                    const isToday = day === today;
                    return (
                        <div key={day} className="border-r px-2 py-2 text-center last:border-r-0">
                            <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                                {formatDay(day, { weekday: 'short' })}
                            </p>
                            <p
                                className={cn(
                                    'mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                                    isToday && 'bg-primary text-primary-foreground',
                                )}
                            >
                                {formatDay(day, { day: 'numeric' })}
                            </p>
                        </div>
                    );
                })}
                <div className="text-muted-foreground border-t border-r px-1 py-1.5 text-right text-[10px] uppercase">
                    Due
                </div>
                {days.map((day) => (
                    <div key={`allday-${day}`} className="min-h-9 space-y-1 border-t border-r p-1 last:border-r-0">
                        {byDay.get(day)?.allDay.map((assessment) => (
                            <AssessmentChip key={assessment.id} assessment={assessment} />
                        ))}
                    </div>
                ))}
            </div>

            {/* Lưới giờ — kéo trên ô trống để thêm việc, kéo khối để dời, bấm khối để sửa. */}
            <div ref={scrollRef} className="max-h-80 overflow-y-auto">
                <div
                    ref={gridRef}
                    className="relative grid touch-none grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]"
                    style={{ height: (HOUR_END - HOUR_START) * HOUR_HEIGHT }}
                    onPointerMove={interactions.onPointerMove}
                    onPointerUp={interactions.onPointerUp}
                    onPointerCancel={interactions.onPointerUp}
                >
                    <div className="relative border-r">
                        {Array.from({ length: HOUR_END - HOUR_START }, (_, index) => (
                            <span
                                key={index}
                                className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[10px]"
                                style={{ top: index * HOUR_HEIGHT }}
                            >
                                {index === 0 ? '' : `${String(HOUR_START + index).padStart(2, '0')}:00`}
                            </span>
                        ))}
                    </div>
                    {days.map((day) => (
                        <div
                            key={`col-${day}`}
                            className={cn(
                                'relative border-r last:border-r-0',
                                day === today && 'bg-primary/[0.04]',
                            )}
                            style={{
                                backgroundImage:
                                    'repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--h) - 1px), var(--border) calc(var(--h) - 1px), var(--border) var(--h))',
                                ['--h' as string]: `${HOUR_HEIGHT}px`,
                            }}
                            onPointerDown={interactions.startCreate}
                        >
                            {eventsByDay.get(day)?.map((event) => {
                                const dragging = interactions.drag;
                                // Khối đang được kéo vẽ theo vị trí tạm, không theo dữ liệu đã lưu.
                                const live =
                                    dragging && dragging.kind !== 'create' && dragging.event.id === event.id
                                        ? dragging.current
                                        : null;
                                if (live && live.day !== day) return null;
                                const startMin = live?.startMin ?? minutesOf(event.startAt, timeZone);
                                const endMin =
                                    live?.endMin ??
                                    (dayKeyOf(event.endAt, timeZone) === day ? minutesOf(event.endAt, timeZone) : 24 * 60);
                                return (
                                    <EventBlock
                                        key={event.id}
                                        label={event.title}
                                        subject={offeringCode(event.offeringId)}
                                        startMin={startMin}
                                        endMin={endMin}
                                        hourStart={HOUR_START}
                                        hourHeight={HOUR_HEIGHT}
                                        onPointerDown={(pointerEvent) => {
                                            pressedRectRef.current = pointerEvent.currentTarget.getBoundingClientRect();
                                            interactions.startMove(pointerEvent, event, 'move');
                                        }}
                                        onResizePointerDown={(pointerEvent) => interactions.startMove(pointerEvent, event, 'resize')}
                                    />
                                );
                            })}
                            {interactions.drag &&
                                ((interactions.drag.kind === 'create' && interactions.drag.current.day === day) ||
                                    (interactions.drag.kind === 'move' &&
                                        interactions.drag.current.day === day &&
                                        interactions.drag.current.day !== interactions.drag.originDay)) && (
                                    <EventBlock
                                        ghost
                                        label={interactions.drag.kind === 'create' ? 'New event' : interactions.drag.event.title}
                                        startMin={interactions.drag.current.startMin}
                                        endMin={interactions.drag.current.endMin}
                                        hourStart={HOUR_START}
                                        hourHeight={HOUR_HEIGHT}
                                    />
                                )}
                            {byDay.get(day)?.timed.map((assessment) => {
                                const { hour, minute } = localTimeOf(assessment.dueAt!, timeZone);
                                const top = (hour - HOUR_START + minute / 60) * HOUR_HEIGHT;
                                return (
                                    <div
                                        key={assessment.id}
                                        className="absolute right-1 left-1"
                                        style={{ top: Math.max(0, top - HOUR_HEIGHT / 2) }}
                                    >
                                        <AssessmentChip assessment={assessment} time={`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`} />
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {editor && (
                <EventEditor
                    state={editor.state}
                    anchor={editor.anchor}
                    timeZone={timeZone}
                    offerings={offerings}
                    saving={saving}
                    onSave={(input) => void saveFromEditor(input)}
                    onDelete={editor.state.mode === 'edit' ? () => void deleteFromEditor() : undefined}
                    onClose={() => setEditor(null)}
                />
            )}
        </section>
    );
}

function AssessmentChip({ assessment, time }: { assessment: PlacedAssessment; time?: string }) {
    return (
        <Link
            href={assessment.href}
            title={`${assessment.offering.subject.code} · ${assessment.name} · ${assessment.weight}%`}
            className={cn(
                'bg-primary/10 text-primary hover:bg-primary/20 block rounded-md border-l-[3px] border-primary px-1.5 py-1 text-[11px] leading-tight transition-colors',
                assessment.hurdle && 'border-brand-amber',
            )}
        >
            <span className="font-semibold">{assessment.offering.subject.code}</span>
            {time && <span className="text-muted-foreground ml-1">{time}</span>}
            <span className="text-foreground/80 block truncate">{assessment.name}</span>
        </Link>
    );
}

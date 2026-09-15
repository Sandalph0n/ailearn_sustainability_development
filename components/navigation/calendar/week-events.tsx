'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CalendarEventDto } from '@/lib/calendar/event-schema';
import { cn } from '@/lib/utils';

import type { CalendarOffering } from './types';
import { dayKeyOf, formatDay, formatMinutes, minutesOf, wallTimeToIso, type DayKey } from './weeks';

/**
 * Lớp sự kiện cá nhân trên lưới giờ, tương tác kiểu Apple Calendar:
 *
 *   - kéo trên ô trống → khối "New event" lớn dần theo con trỏ, thả ra là mở ô nhập tiêu đề;
 *   - bấm nhanh (không kéo) → sự kiện 1 giờ tại chỗ bấm;
 *   - kéo một khối đã có → dời sang giờ khác hoặc ngày khác; kéo mép dưới → đổi độ dài;
 *   - bấm khối → sửa tiêu đề, giờ, ghi chú, môn; xoá.
 *
 * Mọi thao tác kéo bám vào 15 phút. Con trỏ được capture trên chính phần tử bắt đầu kéo, nên kéo
 * ra ngoài cột vẫn theo được và không rơi vào tình trạng "kẹt giữa chừng".
 */

export const SNAP_MINUTES = 15;
const CLICK_TOLERANCE_PX = 4;
const DEFAULT_DURATION = 60;

export type EventDraft = { day: DayKey; startMin: number; endMin: number };

type DragState =
    | { kind: 'create'; day: DayKey; anchorMin: number; current: EventDraft }
    | {
          kind: 'move' | 'resize';
          event: CalendarEventDto;
          startX: number;
          startY: number;
          originDay: DayKey;
          originStart: number;
          originEnd: number;
          moved: boolean;
          current: EventDraft;
      };

export type EditorState =
    | { mode: 'create'; draft: EventDraft }
    | { mode: 'edit'; event: CalendarEventDto };

function snap(minutes: number): number {
    return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clampRange(startMin: number, endMin: number, hourStart: number, hourEnd: number) {
    const lo = hourStart * 60;
    const hi = hourEnd * 60;
    const length = Math.max(SNAP_MINUTES, endMin - startMin);
    const start = Math.max(lo, Math.min(hi - length, startMin));
    return { startMin: start, endMin: Math.min(hi, start + length) };
}

/** Tọa độ con trỏ → (ngày, phút) trên lưới. */
function locate(
    grid: HTMLElement,
    clientX: number,
    clientY: number,
    days: DayKey[],
    hourStart: number,
    hourHeight: number,
    gutterPx: number,
): { day: DayKey; minutes: number } {
    const rect = grid.getBoundingClientRect();
    const dayWidth = (rect.width - gutterPx) / days.length;
    const index = Math.max(0, Math.min(days.length - 1, Math.floor((clientX - rect.left - gutterPx) / dayWidth)));
    const minutes = hourStart * 60 + ((clientY - rect.top) / hourHeight) * 60;
    return { day: days[index], minutes };
}

export function useEventInteractions({
    gridRef,
    days,
    hourStart,
    hourEnd,
    hourHeight,
    gutterPx,
    timeZone,
    onOpenEditor,
    onMoveEvent,
}: {
    gridRef: React.RefObject<HTMLDivElement | null>;
    days: DayKey[];
    hourStart: number;
    hourEnd: number;
    hourHeight: number;
    gutterPx: number;
    timeZone: string;
    onOpenEditor: (state: EditorState) => void;
    onMoveEvent: (event: CalendarEventDto, draft: EventDraft) => void;
}) {
    const [drag, setDrag] = useState<DragState | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const update = (next: DragState | null) => {
        dragRef.current = next;
        setDrag(next);
    };

    const startCreate = (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || !gridRef.current) return;
        // Bấm vào chip hạn nộp (link) hay một khối sự kiện thì không phải là bắt đầu kéo tạo mới.
        if ((event.target as HTMLElement).closest('a,[role="button"]')) return;
        const { day, minutes } = locate(gridRef.current, event.clientX, event.clientY, days, hourStart, hourHeight, gutterPx);
        const anchorMin = snap(minutes);
        event.currentTarget.setPointerCapture(event.pointerId);
        update({
            kind: 'create',
            day,
            anchorMin,
            current: { day, startMin: anchorMin, endMin: anchorMin },
        });
    };

    const startMove = (event: React.PointerEvent<HTMLElement>, target: CalendarEventDto, kind: 'move' | 'resize') => {
        if (event.button !== 0) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const originDay = dayKeyOf(target.startAt, timeZone);
        const originStart = minutesOf(target.startAt, timeZone);
        const originEnd =
            dayKeyOf(target.endAt, timeZone) === originDay ? minutesOf(target.endAt, timeZone) : 24 * 60;
        update({
            kind,
            event: target,
            startX: event.clientX,
            startY: event.clientY,
            originDay,
            originStart,
            originEnd,
            moved: false,
            current: { day: originDay, startMin: originStart, endMin: originEnd },
        });
    };

    const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
        const state = dragRef.current;
        if (!state || !gridRef.current) return;
        const { day, minutes } = locate(gridRef.current, event.clientX, event.clientY, days, hourStart, hourHeight, gutterPx);

        if (state.kind === 'create') {
            const snapped = snap(minutes);
            const startMin = Math.min(state.anchorMin, snapped);
            const endMin = Math.max(state.anchorMin, snapped);
            update({ ...state, current: { ...clampRange(startMin, endMin, hourStart, hourEnd), day: state.day } });
            return;
        }

        const moved =
            state.moved ||
            Math.abs(event.clientX - state.startX) > CLICK_TOLERANCE_PX ||
            Math.abs(event.clientY - state.startY) > CLICK_TOLERANCE_PX;
        const deltaMin = snap(((event.clientY - state.startY) / hourHeight) * 60);
        if (state.kind === 'move') {
            const range = clampRange(state.originStart + deltaMin, state.originEnd + deltaMin, hourStart, hourEnd);
            update({ ...state, moved, current: { day, ...range } });
        } else {
            const endMin = Math.max(state.originStart + SNAP_MINUTES, Math.min(hourEnd * 60, state.originEnd + deltaMin));
            update({ ...state, moved, current: { day: state.originDay, startMin: state.originStart, endMin } });
        }
    };

    const onPointerUp = () => {
        const state = dragRef.current;
        if (!state) return;
        update(null);

        if (state.kind === 'create') {
            const { day, startMin } = state.current;
            const endMin =
                state.current.endMin - startMin < SNAP_MINUTES
                    ? Math.min(hourEnd * 60, startMin + DEFAULT_DURATION)
                    : state.current.endMin;
            onOpenEditor({ mode: 'create', draft: { day, startMin, endMin } });
            return;
        }
        if (!state.moved) {
            onOpenEditor({ mode: 'edit', event: state.event });
            return;
        }
        onMoveEvent(state.event, state.current);
    };

    return { drag, startCreate, startMove, onPointerMove, onPointerUp };
}

// ─── Khối sự kiện ─────────────────────────────────────────────────────────────

export function EventBlock({
    label,
    subject,
    startMin,
    endMin,
    hourStart,
    hourHeight,
    ghost = false,
    onPointerDown,
    onResizePointerDown,
}: {
    label: string;
    subject?: string | null;
    startMin: number;
    endMin: number;
    hourStart: number;
    hourHeight: number;
    ghost?: boolean;
    onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
    onResizePointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
    const top = ((startMin - hourStart * 60) / 60) * hourHeight;
    const height = Math.max(hourHeight / 4, ((endMin - startMin) / 60) * hourHeight);
    return (
        <div
            role="button"
            tabIndex={ghost ? -1 : 0}
            onPointerDown={onPointerDown}
            className={cn(
                'bg-brand-sky/15 border-brand-sky absolute right-1 left-1 select-none overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-[11px] leading-tight',
                ghost ? 'bg-brand-sky/25 border-dashed' : 'hover:bg-brand-sky/25 cursor-grab active:cursor-grabbing',
            )}
            style={{ top, height }}
        >
            <span className="text-foreground block truncate font-semibold">{label}</span>
            <span className="text-muted-foreground block truncate">
                {formatMinutes(startMin)} – {formatMinutes(endMin)}
                {subject ? ` · ${subject}` : ''}
            </span>
            {!ghost && onResizePointerDown && (
                <div
                    aria-hidden
                    onPointerDown={onResizePointerDown}
                    className="absolute right-0 bottom-0 left-0 h-2 cursor-ns-resize"
                />
            )}
        </div>
    );
}

// ─── Ô sửa ────────────────────────────────────────────────────────────────────

export function EventEditor({
    state,
    anchor,
    timeZone,
    offerings,
    saving,
    onSave,
    onDelete,
    onClose,
}: {
    state: EditorState;
    /** Khung của khối vừa bấm/kéo, để đặt ô sửa cạnh nó. */
    anchor: DOMRect | null;
    timeZone: string;
    offerings: CalendarOffering[];
    saving: boolean;
    onSave: (input: { title: string; note: string; day: DayKey; startMin: number; endMin: number; offeringId: string | null }) => void;
    onDelete?: () => void;
    onClose: () => void;
}) {
    const initial =
        state.mode === 'create'
            ? { title: '', note: '', day: state.draft.day, startMin: state.draft.startMin, endMin: state.draft.endMin, offeringId: null as string | null }
            : {
                  title: state.event.title,
                  note: state.event.note ?? '',
                  day: dayKeyOf(state.event.startAt, timeZone),
                  startMin: minutesOf(state.event.startAt, timeZone),
                  endMin:
                      dayKeyOf(state.event.endAt, timeZone) === dayKeyOf(state.event.startAt, timeZone)
                          ? minutesOf(state.event.endAt, timeZone)
                          : 24 * 60,
                  offeringId: state.event.offeringId,
              };
    const [title, setTitle] = useState(initial.title);
    const [note, setNote] = useState(initial.note);
    const [startMin, setStartMin] = useState(initial.startMin);
    const [endMin, setEndMin] = useState(initial.endMin);
    const [offeringId, setOfferingId] = useState<string | null>(initial.offeringId);
    const cardRef = useRef<HTMLDivElement>(null);

    // Bấm ra ngoài hoặc Esc là đóng (bản nháp chưa lưu thì bỏ).
    useEffect(() => {
        const onDown = (event: PointerEvent) => {
            if (cardRef.current && !cardRef.current.contains(event.target as Node)) onClose();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        // Bỏ qua chính cú thả chuột đã mở ô này.
        const timer = window.setTimeout(() => document.addEventListener('pointerdown', onDown), 0);
        document.addEventListener('keydown', onKey);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const width = 304;
    const style: React.CSSProperties = anchor
        ? {
              position: 'fixed',
              left: Math.min(Math.max(8, anchor.right + 8), window.innerWidth - width - 8),
              top: Math.min(Math.max(8, anchor.top), window.innerHeight - 380),
              width,
          }
        : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width };
    // Ô sửa nằm bên phải khối; hết chỗ thì sang bên trái.
    if (anchor && anchor.right + 8 + width > window.innerWidth) {
        style.left = Math.max(8, anchor.left - width - 8);
    }

    const toMinutes = (value: string) => {
        const [h, m] = value.split(':').map(Number);
        return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
    };
    const valid = title.trim().length > 0 && endMin > startMin;

    return (
        <div
            ref={cardRef}
            role="dialog"
            aria-label={state.mode === 'create' ? 'New event' : 'Edit event'}
            className="bg-popover text-popover-foreground z-50 rounded-xl border p-4 shadow-lg"
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <form
                className="space-y-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!valid) return;
                    onSave({ title: title.trim(), note, day: initial.day, startMin, endMin, offeringId });
                }}
            >
                <Input
                    autoFocus
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="New event"
                    aria-label="Title"
                    className="text-base font-medium"
                />
                <p className="text-muted-foreground text-xs">
                    {formatDay(initial.day, { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <div className="flex items-center gap-2">
                    <Input
                        type="time"
                        step={SNAP_MINUTES * 60}
                        value={formatMinutes(startMin)}
                        onChange={(event) => setStartMin(toMinutes(event.target.value))}
                        aria-label="Start time"
                        className="w-28"
                    />
                    <span className="text-muted-foreground text-xs">to</span>
                    <Input
                        type="time"
                        step={SNAP_MINUTES * 60}
                        value={formatMinutes(Math.min(endMin, 23 * 60 + 59))}
                        onChange={(event) => setEndMin(toMinutes(event.target.value))}
                        aria-label="End time"
                        className="w-28"
                    />
                </div>
                {offerings.length > 0 && (
                    <Select
                        items={{ none: 'No subject', ...Object.fromEntries(offerings.map((o) => [o.id, o.subject.code])) }}
                        value={offeringId ?? 'none'}
                        onValueChange={(next) => setOfferingId(next === 'none' || !next ? null : next)}
                    >
                        <SelectTrigger aria-label="Subject" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No subject</SelectItem>
                            {offerings.map((offering) => (
                                <SelectItem key={offering.id} value={offering.id}>
                                    {offering.subject.code} · {offering.subject.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Notes"
                    aria-label="Notes"
                    className="min-h-16 text-sm"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                    {onDelete ? (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onDelete} disabled={saving}>
                            Delete
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={!valid || saving}>
                            {saving ? 'Saving…' : state.mode === 'create' ? 'Add' : 'Save'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}

// ─── Gọi API ──────────────────────────────────────────────────────────────────

async function responseMessage(response: Response, fallback: string): Promise<string> {
    const body = await response.json().catch(() => null);
    return body?.error?.message ?? fallback;
}

export async function saveEventRequest(
    input: { id?: string; title: string; note: string; day: DayKey; startMin: number; endMin: number; offeringId: string | null },
    timeZone: string,
): Promise<CalendarEventDto> {
    const payload = {
        title: input.title,
        note: input.note || null,
        startAt: wallTimeToIso(input.day, input.startMin, timeZone),
        endAt: wallTimeToIso(input.day, input.endMin, timeZone),
        offeringId: input.offeringId,
    };
    const response = await fetch(input.id ? `/api/me/calendar-events/${input.id}` : '/api/me/calendar-events', {
        method: input.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await responseMessage(response, 'Could not save the event.'));
    const body = (await response.json()) as { event: CalendarEventDto };
    return { ...payload, id: body.event.id };
}

export async function deleteEventRequest(id: string): Promise<void> {
    const response = await fetch(`/api/me/calendar-events/${id}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
        throw new Error(await responseMessage(response, 'Could not delete the event.'));
    }
}

export function reportError(error: unknown): void {
    toast.error(error instanceof Error ? error.message : 'Something went wrong.');
}

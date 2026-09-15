// File này làm toán lịch cho trang Calendar bằng "ngày dân sự" (chuỗi YYYY-MM-DD) theo múi giờ của
// cơ sở. Làm trên chuỗi ngày thay vì Date để "thứ Hai tuần này" không đổi theo máy người xem.
import type { CalendarAssessment, CalendarPeriod, CalendarTerm } from './types';

export type DayKey = string; // YYYY-MM-DD

/** Ngày dân sự của một mốc thời gian, tính theo múi giờ cho trước. */
export function dayKeyOf(value: string | Date, timeZone: string): DayKey {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(value));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Giờ:phút địa phương của một mốc, để biết "23:59" (hạn cuối ngày) hay một giờ cụ thể. */
export function localTimeOf(value: string, timeZone: string): { hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
    return { hour: get('hour'), minute: get('minute') };
}

function toUtc(key: DayKey): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): DayKey {
    return date.toISOString().slice(0, 10);
}

export function addDays(key: DayKey, days: number): DayKey {
    const date = toUtc(key);
    date.setUTCDate(date.getUTCDate() + days);
    return fromUtc(date);
}

export function diffDays(from: DayKey, to: DayKey): number {
    return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Thứ Hai của tuần chứa ngày này (tuần bắt đầu thứ Hai, như lịch học vụ). */
export function mondayOf(key: DayKey): DayKey {
    const weekday = toUtc(key).getUTCDay(); // 0 = Sunday
    return addDays(key, weekday === 0 ? -6 : 1 - weekday);
}

export function weekDays(monday: DayKey): DayKey[] {
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function formatDay(key: DayKey, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', ...options }).format(toUtc(key));
}

export type TermWeek = {
    /** Thứ Hai. */
    start: DayKey;
    /** Chủ nhật. */
    end: DayKey;
    type: CalendarPeriod['type'] | 'GAP';
    /** "Wk 3", "Recess", "Exams" — nhãn cột trên Gantt. */
    label: string;
    /** Số tuần dạy (1..13); null với recess/exam/gap. */
    teachingWeek: number | null;
    periodName: string | null;
};

function periodContaining(periods: CalendarPeriod[], key: DayKey, timeZone: string) {
    return periods.find(
        (period) => dayKeyOf(period.startAt, timeZone) <= key && key <= dayKeyOf(period.endAt, timeZone),
    );
}

/**
 * Chia kỳ thành các tuần Thứ Hai→Chủ nhật, từ tuần chứa ngày đầu giai đoạn đầu tới tuần chứa ngày
 * cuối giai đoạn cuối. Tuần dạy được đánh số liên tục qua các giai đoạn TEACHING (recess không
 * làm đứt số), giống cách trường gọi "Week 8" ngay sau kỳ nghỉ.
 */
export function buildTermWeeks(term: CalendarTerm, timeZone: string): TermWeek[] {
    if (term.periods.length === 0) return [];
    const sorted = [...term.periods].sort((a, b) => a.startAt.localeCompare(b.startAt));
    const first = mondayOf(dayKeyOf(sorted[0].startAt, timeZone));
    const last = mondayOf(dayKeyOf(sorted[sorted.length - 1].endAt, timeZone));

    const weeks: TermWeek[] = [];
    let teaching = 0;
    for (let monday = first; monday <= last; monday = addDays(monday, 7)) {
        // Giai đoạn của tuần = giai đoạn chứa ngày giữa tuần, để tuần chuyển tiếp nghiêng về bên
        // chiếm phần lớn tuần.
        const period =
            periodContaining(sorted, addDays(monday, 2), timeZone) ??
            periodContaining(sorted, monday, timeZone);
        const type = period?.type ?? 'GAP';
        const teachingWeek = type === 'TEACHING' ? ++teaching : null;
        weeks.push({
            start: monday,
            end: addDays(monday, 6),
            type,
            teachingWeek,
            periodName: period?.name ?? null,
            label:
                type === 'TEACHING'
                    ? `Wk ${teachingWeek}`
                    : type === 'BREAK'
                      ? 'Recess'
                      : type === 'EXAM'
                        ? 'Exams'
                        : '—',
        });
    }
    return weeks;
}

/**
 * Tuần một bài rơi vào. Có `dueAt` thì theo ngày; không thì đọc "week 6" trong nhãn hạn nộp —
 * Unit Guide hay ghi kiểu đó thay vì ngày cụ thể. Không suy ra được thì trả null.
 */
export function weekIndexOf(
    assessment: CalendarAssessment,
    weeks: TermWeek[],
    timeZone: string,
): number | null {
    if (assessment.dueAt) {
        const key = dayKeyOf(assessment.dueAt, timeZone);
        const index = weeks.findIndex((week) => week.start <= key && key <= week.end);
        return index >= 0 ? index : null;
    }
    const match = assessment.expectedDue?.match(/\bweek\s*(\d{1,2})\b/i);
    if (match) {
        const index = weeks.findIndex((week) => week.teachingWeek === Number(match[1]));
        return index >= 0 ? index : null;
    }
    if (/\bexam/i.test(assessment.expectedDue ?? '')) {
        const index = weeks.findIndex((week) => week.type === 'EXAM');
        return index >= 0 ? index : null;
    }
    return null;
}

/** Số phút kể từ 00:00 địa phương của một mốc thời gian. */
export function minutesOf(value: string, timeZone: string): number {
    const { hour, minute } = localTimeOf(value, timeZone);
    return hour * 60 + minute;
}

/**
 * Mốc UTC của "ngày này, phút này" theo giờ tường của múi giờ — ngược với `dayKeyOf`/`minutesOf`.
 * Đoán bằng UTC rồi trừ đi độ lệch múi giờ tại chính mốc đó; lặp hai lần để qua được ranh giới
 * đổi giờ mùa hè.
 */
export function wallTimeToIso(day: DayKey, minutes: number, timeZone: string): string {
    const [year, month, date] = day.split('-').map(Number);
    let guess = Date.UTC(year, month - 1, date, Math.floor(minutes / 60), minutes % 60);
    for (let pass = 0; pass < 2; pass += 1) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(new Date(guess));
        const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
        const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
        const target = Date.UTC(year, month - 1, date, Math.floor(minutes / 60), minutes % 60);
        guess -= wallAsUtc - target;
    }
    return new Date(guess).toISOString();
}

export function formatMinutes(minutes: number): string {
    const clamped = Math.max(0, Math.min(24 * 60, minutes));
    return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

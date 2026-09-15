import { CalendarPlanner } from '@/components/navigation/calendar/calendar-planner';
import { dayKeyOf } from '@/components/navigation/calendar/weeks';
import { LearningPageHeader } from '@/components/navigation/learning/page-header';
import {
    loadLearningCalendar,
    requireLearningPageAccess,
} from '@/components/navigation/learning/server';
import { PERMISSION_CODE } from '@/lib/auth/permissions';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Lịch cá nhân: tuần đang học ở trên, cả kỳ ở dưới, đánh dấu bài đánh giá của những môn vai trò
 * này được xem. Dữ liệu và quyền đi chung đường với "My Subjects".
 */
export default async function CalendarPage({ searchParams }: PageProps<'/navigation/calendar'>) {
    const query = await searchParams;
    const { userId, access } = await requireLearningPageAccess(query, PERMISSION_CODE.OFFERING_VIEW);
    const now = new Date();
    const [data, events, plans] = await Promise.all([
        loadLearningCalendar(access, now),
        db.calendarEvent.findMany({
            where: { userId },
            orderBy: { startAt: 'asc' },
            select: { id: true, title: true, note: true, startAt: true, endAt: true, offeringId: true },
        }),
        db.assessmentPlan.findMany({
            where: { userId },
            select: { assessmentId: true, startDate: true, endDate: true },
        }),
    ]);

    return (
        <main className="mx-auto w-full max-w-7xl py-7">
            <LearningPageHeader
                eyebrow="Personal"
                title="Calendar"
                description="Your week at the top, the whole study term underneath. Assessment due dates come from the subjects you can access."
            />
            <CalendarPlanner
                data={data}
                today={dayKeyOf(now, data.timeZone)}
                initialEvents={events.map((event) => ({
                    ...event,
                    startAt: event.startAt.toISOString(),
                    endAt: event.endAt.toISOString(),
                }))}
                initialPlans={plans.map((plan) => ({
                    assessmentId: plan.assessmentId,
                    startDate: plan.startDate.toISOString().slice(0, 10),
                    endDate: plan.endDate.toISOString().slice(0, 10),
                }))}
            />
        </main>
    );
}

// File này là hình dạng dữ liệu trang Calendar nhận từ server — mọi ngày giờ đã là chuỗi ISO
// để đi qua ranh giới server/client mà không mất múi giờ.

export type CalendarPeriod = {
    id: string;
    name: string;
    type: 'TEACHING' | 'BREAK' | 'EXAM';
    startAt: string;
    endAt: string;
};

export type CalendarTerm = {
    id: string;
    year: number;
    session: number;
    periods: CalendarPeriod[];
};

export type CalendarAssessment = {
    id: string;
    offeringId: string;
    name: string;
    weight: number;
    hurdle: boolean;
    isGroup: boolean;
    /** Có khi nguồn chỉ ghi "In week 6, during the SGTA" — khi đó `dueAt` rỗng. */
    dueAt: string | null;
    expectedDue: string | null;
    /** Đường dẫn tới trang bài, đã kèm context của vai trò đang dùng. */
    href: string;
};

export type CalendarOffering = {
    id: string;
    termId: string;
    subject: { code: string; name: string };
    assessments: CalendarAssessment[];
};

export type CalendarData = {
    /** Múi giờ để dựng lưới ngày — lịch học vụ của cơ sở, không phải của trình duyệt. */
    timeZone: string;
    terms: CalendarTerm[];
    offerings: CalendarOffering[];
    /** Không có quyền xem bài (vai trò chỉ được xem môn): lịch chỉ hiện kỳ và tuần. */
    canSeeAssessments: boolean;
};

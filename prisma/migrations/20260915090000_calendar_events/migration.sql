-- Lịch cá nhân: mục do người dùng tự tạo trên trang Calendar. Riêng tư theo user, tuỳ chọn gắn
-- với một lượt mở môn; xoá user thì xoá theo, xoá môn thì chỉ gỡ liên kết.
CREATE TABLE "CalendarEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "offeringId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CalendarEvent_start_before_end_check" CHECK ("startAt" < "endAt")
);

CREATE INDEX "CalendarEvent_userId_startAt_idx" ON "CalendarEvent"("userId", "startAt");
CREATE INDEX "CalendarEvent_offeringId_idx" ON "CalendarEvent"("offeringId");

ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

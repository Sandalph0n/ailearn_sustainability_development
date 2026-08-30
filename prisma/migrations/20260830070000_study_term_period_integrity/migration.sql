-- Một period có độ dài âm hoặc bằng 0 không thể dùng để dựng lịch hay kiểm deadline.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "StudyTermPeriod"
        WHERE "startAt" >= "endAt"
    ) THEN
        RAISE EXCEPTION 'Cannot add StudyTermPeriod date constraint: invalid rows exist';
    END IF;
END
$$;

ALTER TABLE "StudyTermPeriod"
ADD CONSTRAINT "StudyTermPeriod_start_before_end_check"
CHECK ("startAt" < "endAt");

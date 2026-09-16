-- Mỗi lần chấm được giữ thành một record riêng để một attempt có thể được nhiều người chấm,
-- và cùng một người cũng có thể chấm lại mà không ghi đè lịch sử.
CREATE TYPE "AssessmentAttemptMarkStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SUPERSEDED');

CREATE TABLE "AssessmentAttemptMark" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attemptId" UUID NOT NULL,
    "markedById" UUID NOT NULL,
    "score" DECIMAL(10,2),
    "outOf" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "feedback" TEXT,
    "status" "AssessmentAttemptMarkStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "supersedesMarkId" UUID,

    CONSTRAINT "AssessmentAttemptMark_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssessmentAttemptMark_score_non_negative_check"
        CHECK ("score" IS NULL OR "score" >= 0),
    CONSTRAINT "AssessmentAttemptMark_outOf_positive_check"
        CHECK ("outOf" > 0),
    CONSTRAINT "AssessmentAttemptMark_score_within_scale_check"
        CHECK ("score" IS NULL OR "score" <= "outOf"),
    CONSTRAINT "AssessmentAttemptMark_submission_state_check"
        CHECK (
            ("status" = 'DRAFT' AND "submittedAt" IS NULL)
            OR ("status" IN ('SUBMITTED', 'SUPERSEDED') AND "submittedAt" IS NOT NULL)
        )
);

-- Một attempt chỉ có một kết quả chính thức tại một thời điểm. `markId + attemptId` dùng foreign
-- key ghép để không thể chọn nhầm bản chấm thuộc attempt khác.
CREATE TABLE "AssessmentAttemptResult" (
    "attemptId" UUID NOT NULL,
    "markId" UUID NOT NULL,
    "finalisedById" UUID NOT NULL,
    "finalisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "AssessmentAttemptResult_pkey" PRIMARY KEY ("attemptId")
);

CREATE UNIQUE INDEX "AssessmentAttemptMark_id_attemptId_key"
    ON "AssessmentAttemptMark"("id", "attemptId");
CREATE INDEX "AssessmentAttemptMark_attemptId_createdAt_idx"
    ON "AssessmentAttemptMark"("attemptId", "createdAt");
CREATE INDEX "AssessmentAttemptMark_attemptId_status_idx"
    ON "AssessmentAttemptMark"("attemptId", "status");
CREATE INDEX "AssessmentAttemptMark_markedById_createdAt_idx"
    ON "AssessmentAttemptMark"("markedById", "createdAt");
CREATE INDEX "AssessmentAttemptMark_supersedesMarkId_attemptId_idx"
    ON "AssessmentAttemptMark"("supersedesMarkId", "attemptId");

CREATE UNIQUE INDEX "AssessmentAttemptResult_markId_attemptId_key"
    ON "AssessmentAttemptResult"("markId", "attemptId");
CREATE INDEX "AssessmentAttemptResult_finalisedById_finalisedAt_idx"
    ON "AssessmentAttemptResult"("finalisedById", "finalisedAt");

ALTER TABLE "AssessmentAttemptMark" ADD CONSTRAINT "AssessmentAttemptMark_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptMark" ADD CONSTRAINT "AssessmentAttemptMark_markedById_fkey"
    FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptMark" ADD CONSTRAINT "AssessmentAttemptMark_supersedesMarkId_attemptId_fkey"
    FOREIGN KEY ("supersedesMarkId", "attemptId") REFERENCES "AssessmentAttemptMark"("id", "attemptId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentAttemptResult" ADD CONSTRAINT "AssessmentAttemptResult_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptResult" ADD CONSTRAINT "AssessmentAttemptResult_markId_attemptId_fkey"
    FOREIGN KEY ("markId", "attemptId") REFERENCES "AssessmentAttemptMark"("id", "attemptId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttemptResult" ADD CONSTRAINT "AssessmentAttemptResult_finalisedById_fkey"
    FOREIGN KEY ("finalisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

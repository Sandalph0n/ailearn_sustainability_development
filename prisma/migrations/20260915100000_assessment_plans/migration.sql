-- Kế hoạch làm bài của từng người học (ngày bắt đầu → ngày kết thúc dự định), vẽ thành dải trên
-- Gantt của trang Calendar. Một người một kế hoạch cho mỗi bài; xoá user hay bài thì xoá theo.
CREATE TABLE "AssessmentPlan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssessmentPlan_start_before_end_check" CHECK ("startDate" <= "endDate")
);

CREATE UNIQUE INDEX "AssessmentPlan_userId_assessmentId_key" ON "AssessmentPlan"("userId", "assessmentId");
CREATE INDEX "AssessmentPlan_assessmentId_idx" ON "AssessmentPlan"("assessmentId");

ALTER TABLE "AssessmentPlan" ADD CONSTRAINT "AssessmentPlan_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentPlan" ADD CONSTRAINT "AssessmentPlan_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

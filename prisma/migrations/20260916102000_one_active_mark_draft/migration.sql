-- A marker may submit multiple independent rounds for the same attempt, but may only have one
-- resumable draft at a time. This closes the double-click/concurrent-request race in the UI
-- without restricting other markers or the submitted history.
CREATE UNIQUE INDEX "AssessmentAttemptMark_one_draft_per_marker_attempt_key"
    ON "AssessmentAttemptMark"("attemptId", "markedById")
    WHERE "status" = 'DRAFT';

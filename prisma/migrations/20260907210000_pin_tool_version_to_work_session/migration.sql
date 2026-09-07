-- Existing work sessions predate deployable ToolVersion records, so this column is nullable for
-- historical compatibility. New session creation must copy Tool.activeVersionId here.
ALTER TABLE "AssignmentWorkSession"
ADD COLUMN "toolVersionId" UUID;

CREATE INDEX "AssignmentWorkSession_toolVersionId_idx"
ON "AssignmentWorkSession"("toolVersionId");

-- A session must never claim a version belonging to a different tool. A composite unique target
-- lets Postgres enforce the pair.
CREATE UNIQUE INDEX "ToolVersion_id_toolId_key" ON "ToolVersion"("id", "toolId");

ALTER TABLE "AssignmentWorkSession"
ADD CONSTRAINT "AssignmentWorkSession_toolVersionId_toolId_fkey"
FOREIGN KEY ("toolVersionId", "toolId") REFERENCES "ToolVersion"("id", "toolId")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- API versioning lives in the route namespace (`/api/tool/v1`), so a second protocol version
-- on every uploaded package would create two competing compatibility sources.
ALTER TABLE "ToolVersion" DROP COLUMN "protocolVersion";

-- Tool clients retry batches after network failures. The client-generated UUID makes that retry
-- idempotent without treating two different batches with identical event JSON as the same batch.
ALTER TABLE "EventBatch" ADD COLUMN "clientBatchId" UUID;

UPDATE "EventBatch"
SET "clientBatchId" = gen_random_uuid()
WHERE "clientBatchId" IS NULL;

ALTER TABLE "EventBatch" ALTER COLUMN "clientBatchId" SET NOT NULL;

CREATE UNIQUE INDEX "EventBatch_assignmentWorkSessionId_clientBatchId_key"
ON "EventBatch"("assignmentWorkSessionId", "clientBatchId");

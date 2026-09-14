ALTER TABLE "EventBatch"
ADD COLUMN "payloadHash" VARCHAR(64),
ADD COLUMN "previousChainHash" VARCHAR(64),
ADD COLUMN "chainHash" VARCHAR(64);

ALTER TABLE "EventBatch"
ADD CONSTRAINT "EventBatch_payloadHash_format"
CHECK ("payloadHash" IS NULL OR "payloadHash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "EventBatch_previousChainHash_format"
CHECK ("previousChainHash" IS NULL OR "previousChainHash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "EventBatch_chainHash_format"
CHECK ("chainHash" IS NULL OR "chainHash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "EventBatch_integrity_all_or_none"
CHECK (
  ("payloadHash" IS NULL AND "chainHash" IS NULL)
  OR
  ("payloadHash" IS NOT NULL AND "chainHash" IS NOT NULL)
);

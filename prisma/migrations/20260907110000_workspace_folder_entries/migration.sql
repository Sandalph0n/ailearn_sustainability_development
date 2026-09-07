-- Workspace folders are metadata-only Document entries. Existing rows remain files.
CREATE TYPE "WorkspaceEntryKind" AS ENUM ('FILE', 'FOLDER');

ALTER TABLE "Document"
ADD COLUMN "entryKind" "WorkspaceEntryKind" NOT NULL DEFAULT 'FILE',
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "sizeBytes" INTEGER,
ALTER COLUMN "contentHash" DROP NOT NULL;

-- Materialise parent folders for any legacy file that already used a nested display path.
INSERT INTO "Document" (
  "id",
  "workspaceId",
  "displayPath",
  "entryKind",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT
  gen_random_uuid(),
  nested."workspaceId",
  array_to_string(nested.parts[1:depth.value], '/'),
  'FOLDER'::"WorkspaceEntryKind",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT "workspaceId", string_to_array("displayPath", '/') AS parts
  FROM "Document"
) AS nested
CROSS JOIN LATERAL generate_series(1, array_length(nested.parts, 1) - 1) AS depth(value)
ON CONFLICT ("workspaceId", "displayPath") DO NOTHING;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_entry_content_check" CHECK (
  ("entryKind" = 'FOLDER' AND "contentHash" IS NULL AND "mimeType" IS NULL AND "sizeBytes" IS NULL)
  OR
  ("entryKind" = 'FILE' AND "contentHash" IS NOT NULL AND ("sizeBytes" IS NULL OR "sizeBytes" >= 0))
);

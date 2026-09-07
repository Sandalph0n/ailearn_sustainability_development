-- Tool giữ danh tính; mỗi lần upload tạo một ToolVersion bất biến.
ALTER TABLE "Tool"
ADD COLUMN "activeVersionId" UUID,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- `@updatedAt` do Prisma ghi. Default chỉ dùng để backfill các Tool đã có trước migration.
ALTER TABLE "Tool" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE "ToolVersion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "toolId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "entryPath" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "archiveKey" TEXT NOT NULL,
    "storagePrefix" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "compressedSize" INTEGER NOT NULL,
    "unpackedSize" INTEGER NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ToolVersion_archiveKey_key" ON "ToolVersion"("archiveKey");
CREATE UNIQUE INDEX "ToolVersion_storagePrefix_key" ON "ToolVersion"("storagePrefix");
CREATE INDEX "ToolVersion_toolId_createdAt_idx" ON "ToolVersion"("toolId", "createdAt");
CREATE INDEX "ToolVersion_createdById_idx" ON "ToolVersion"("createdById");
CREATE UNIQUE INDEX "ToolVersion_toolId_version_key" ON "ToolVersion"("toolId", "version");
CREATE UNIQUE INDEX "Tool_activeVersionId_key" ON "Tool"("activeVersionId");

ALTER TABLE "ToolVersion"
ADD CONSTRAINT "ToolVersion_toolId_fkey"
FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ToolVersion"
ADD CONSTRAINT "ToolVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Tool"
ADD CONSTRAINT "Tool_activeVersionId_fkey"
FOREIGN KEY ("activeVersionId") REFERENCES "ToolVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK trên chỉ chứng minh version tồn tại. Trigger này còn chứng minh version thuộc chính Tool.
CREATE OR REPLACE FUNCTION "ensureActiveVersionBelongsToTool"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."activeVersionId" IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM "ToolVersion"
        WHERE "ToolVersion"."id" = NEW."activeVersionId"
          AND "ToolVersion"."toolId" = NEW."id"
    ) THEN
        RAISE EXCEPTION 'Active tool version must belong to the same tool';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Tool_active_version_owner_trigger"
BEFORE INSERT OR UPDATE OF "activeVersionId" ON "Tool"
FOR EACH ROW
EXECUTE FUNCTION "ensureActiveVersionBelongsToTool"();

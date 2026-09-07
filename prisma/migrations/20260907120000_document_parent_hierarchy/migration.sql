-- Replace materialised display paths with an adjacency-list tree.
-- Existing paths are split into a local name and a self-referencing parent folder.
BEGIN;

ALTER TABLE "Document"
ADD COLUMN "name" TEXT,
ADD COLUMN "parentFolderId" UUID;

UPDATE "Document"
SET "name" = regexp_replace("displayPath", '^.*/', '');

UPDATE "Document" AS child
SET "parentFolderId" = parent."id"
FROM "Document" AS parent
WHERE strpos(child."displayPath", '/') > 0
  AND parent."workspaceId" = child."workspaceId"
  AND parent."entryKind" = 'FOLDER'
  AND parent."displayPath" = regexp_replace(child."displayPath", '/[^/]+$', '');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Document"
    WHERE strpos("displayPath", '/') > 0
      AND "parentFolderId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate Document tree: at least one nested entry has no parent folder';
  END IF;
END $$;

DROP INDEX "Document_workspaceId_displayPath_key";

ALTER TABLE "Document"
ALTER COLUMN "name" SET NOT NULL,
DROP COLUMN "displayPath";

CREATE UNIQUE INDEX "Document_workspaceId_id_key"
ON "Document"("workspaceId", "id");

-- PostgreSQL treats NULL values as distinct in a regular unique index, so root entries
-- need their own partial index while nested siblings use the Prisma-declared index below.
CREATE UNIQUE INDEX "Document_workspaceId_root_name_key"
ON "Document"("workspaceId", "name")
WHERE "parentFolderId" IS NULL;

CREATE UNIQUE INDEX "Document_workspaceId_parentFolderId_name_key"
ON "Document"("workspaceId", "parentFolderId", "name");

CREATE INDEX "Document_workspaceId_parentFolderId_idx"
ON "Document"("workspaceId", "parentFolderId");

ALTER TABLE "Document"
ADD CONSTRAINT "Document_parentFolder_fkey"
FOREIGN KEY ("workspaceId", "parentFolderId")
REFERENCES "Document"("workspaceId", "id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_name_check" CHECK (
  char_length("name") BETWEEN 1 AND 255
  AND "name" NOT IN ('.', '..')
  AND "name" !~ '[/\\]'
);

-- A relational FK guarantees that the parent exists in the same workspace. This trigger
-- adds the two properties a plain FK cannot express: the parent must be a folder, and the
-- self-reference must remain acyclic if move support is added later.
CREATE FUNCTION "validateDocumentParent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."parentFolderId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "Document" AS parent
    WHERE parent."workspaceId" = NEW."workspaceId"
      AND parent."id" = NEW."parentFolderId"
      AND parent."entryKind" = 'FOLDER'
  ) THEN
    RAISE EXCEPTION 'Document parent must be a folder in the same workspace';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT parent."id", parent."parentFolderId"
      FROM "Document" AS parent
      WHERE parent."workspaceId" = NEW."workspaceId"
        AND parent."id" = NEW."parentFolderId"

      UNION ALL

      SELECT parent."id", parent."parentFolderId"
      FROM "Document" AS parent
      JOIN ancestors ON ancestors."parentFolderId" = parent."id"
      WHERE parent."workspaceId" = NEW."workspaceId"
    )
    SELECT 1 FROM ancestors WHERE "id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Document hierarchy cannot contain a cycle';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Document_validate_parent"
BEFORE INSERT OR UPDATE OF "workspaceId", "parentFolderId", "entryKind"
ON "Document"
FOR EACH ROW
EXECUTE FUNCTION "validateDocumentParent"();

COMMIT;

-- Prevent an existing parent from being converted into a file while it still has children.
CREATE OR REPLACE FUNCTION "validateDocumentParent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."entryKind" <> 'FOLDER' AND EXISTS (
    SELECT 1
    FROM "Document" AS child
    WHERE child."workspaceId" = NEW."workspaceId"
      AND child."parentFolderId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'A document with children must remain a folder';
  END IF;

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

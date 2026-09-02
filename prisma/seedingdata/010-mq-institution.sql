-- Generated from source/mq-2026/institutions.csv by scripts/seeding/generate-mq-2026-sql.mjs.
-- Review the CSV source and regenerate; do not hand-edit this file.

INSERT INTO "Institution" ("id", "name", "website")
VALUES     ('f715afb4-9475-5d59-a61f-e66d50c03fdb'::uuid, 'Macquarie University', 'https://www.mq.edu.au/')
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name", "website" = EXCLUDED."website";

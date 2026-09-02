-- Generated from source/mq-2026/terms.csv by scripts/seeding/generate-mq-2026-sql.mjs.
-- Review the CSV source and regenerate; do not hand-edit this file.

INSERT INTO "StudyTerm" ("id", "institutionId", "year", "session")
SELECT seed."id"::uuid, institution."id", seed."year", seed."session"
FROM (VALUES
    ('a2fbe583-450b-5d7a-8041-a1a4c324dedc', 2026, 1),
    ('31bc728d-7b28-50c4-b303-317de916cfc9', 2026, 2)
) AS seed("id", "year", "session")
CROSS JOIN "Institution" AS institution
WHERE institution."name" = 'Macquarie University'
ON CONFLICT ("institutionId", "year", "session") DO NOTHING;

-- Macquarie 2026 study-period structure (teaching halves, mid-session recess, exams).
-- Dates from the published Macquarie academic calendar. Hand-maintained; the Handbook
-- pipeline does not carry these. Safe to re-run: a period is only inserted when the term has
-- no period with the same name yet, so edits made in the admin UI are kept.
--
-- Columns are timestamp WITHOUT time zone holding UTC, so each Sydney-local day boundary is
-- converted explicitly: 00:00 on the first day, 23:59:59 on the last.

WITH seed("year", "session", "name", "type", "firstDay", "lastDay") AS (
    VALUES
        (2026, 1, 'Weeks 1–7',   'TEACHING', DATE '2026-02-23', DATE '2026-04-05'),
        (2026, 1, 'Recess',      'BREAK',    DATE '2026-04-06', DATE '2026-04-19'),
        (2026, 1, 'Weeks 8–13',  'TEACHING', DATE '2026-04-20', DATE '2026-06-07'),
        (2026, 1, 'Exams',       'EXAM',     DATE '2026-06-09', DATE '2026-06-26'),
        (2026, 2, 'Weeks 1–8',   'TEACHING', DATE '2026-07-27', DATE '2026-09-20'),
        (2026, 2, 'Recess',      'BREAK',    DATE '2026-09-21', DATE '2026-10-04'),
        (2026, 2, 'Weeks 9–13',  'TEACHING', DATE '2026-10-05', DATE '2026-11-08'),
        (2026, 2, 'Exams',       'EXAM',     DATE '2026-11-09', DATE '2026-11-27')
)
INSERT INTO "StudyTermPeriod" ("studyTermId", "name", "type", "startAt", "endAt")
SELECT
    term."id",
    seed."name",
    seed."type"::"StudyTermPeriodType",
    (seed."firstDay"::timestamp AT TIME ZONE 'Australia/Sydney') AT TIME ZONE 'UTC',
    ((seed."lastDay" + INTERVAL '1 day' - INTERVAL '1 second')::timestamp AT TIME ZONE 'Australia/Sydney') AT TIME ZONE 'UTC'
FROM seed
JOIN "Institution" AS institution ON institution."name" = 'Macquarie University'
JOIN "StudyTerm" AS term
  ON term."institutionId" = institution."id"
 AND term."year" = seed."year"
 AND term."session" = seed."session"
WHERE NOT EXISTS (
    SELECT 1 FROM "StudyTermPeriod" AS existing
    WHERE existing."studyTermId" = term."id" AND existing."name" = seed."name"
);

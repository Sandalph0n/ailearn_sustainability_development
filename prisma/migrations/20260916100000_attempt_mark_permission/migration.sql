-- Marking is intentionally separate from viewing attempts and replaying tool sessions. A role
-- may receive any combination, and every route checks the exact action it performs.
INSERT INTO "Permission" ("permission", "description")
VALUES (
    'attempt.mark',
    'Create, continue, and submit marks for assessment attempts in scope.'
)
ON CONFLICT ("permission")
DO UPDATE SET "description" = EXCLUDED."description";

-- Unit guides often publish a teaching-week description instead of a calendar timestamp.
ALTER TABLE "Assessment"
    ADD COLUMN "expectedDue" TEXT,
    ALTER COLUMN "dueAt" DROP NOT NULL;

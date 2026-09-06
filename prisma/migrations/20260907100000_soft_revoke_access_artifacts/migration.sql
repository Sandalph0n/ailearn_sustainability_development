-- Scope grants and one-use codes are authorization evidence. Revoking them must preserve history.
ALTER TABLE "ScopeAssignment"
ADD COLUMN "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "revokedAt" TIMESTAMPTZ,
ADD COLUMN "revokedById" UUID;

DROP INDEX "ScopeAssignment_roleAssignmentId_offeringId_key";

CREATE UNIQUE INDEX "ScopeAssignment_active_roleAssignmentId_offeringId_key"
ON "ScopeAssignment"("roleAssignmentId", "offeringId")
WHERE "revokedAt" IS NULL;

CREATE INDEX "ScopeAssignment_revokedById_idx" ON "ScopeAssignment"("revokedById");

ALTER TABLE "ScopeAssignment"
ADD CONSTRAINT "ScopeAssignment_revokedById_fkey"
FOREIGN KEY ("revokedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScopeAssignmentCode"
ADD COLUMN "revokedAt" TIMESTAMPTZ,
ADD COLUMN "revokedById" UUID;

CREATE INDEX "ScopeAssignmentCode_revokedById_idx" ON "ScopeAssignmentCode"("revokedById");

ALTER TABLE "ScopeAssignmentCode"
ADD CONSTRAINT "ScopeAssignmentCode_revokedById_fkey"
FOREIGN KEY ("revokedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScopeAssignmentCode"
ADD CONSTRAINT "ScopeAssignmentCode_usage_or_revocation_check" CHECK (
  NOT ("usedAt" IS NOT NULL AND "revokedAt" IS NOT NULL)
);

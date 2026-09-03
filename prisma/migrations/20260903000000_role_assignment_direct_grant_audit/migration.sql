-- Ghi lại người đã cấp RoleAssignment trực tiếp, không thông qua RoleRequest.
-- Nullable để assignment sinh từ request tiếp tục truy vết qua RoleRequest.processedByUserId.
ALTER TABLE "RoleAssignment"
ADD COLUMN "grantDirectlyById" UUID;

CREATE INDEX "RoleAssignment_grantDirectlyById_idx"
ON "RoleAssignment"("grantDirectlyById");

ALTER TABLE "RoleAssignment"
ADD CONSTRAINT "RoleAssignment_grantDirectlyById_fkey"
FOREIGN KEY ("grantDirectlyById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

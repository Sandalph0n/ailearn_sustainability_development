-- Chỗ trỏ tới ảnh đại diện và logo trong bucket `media`.
--
-- Cả hai đều nullable, nên migration này không đụng vào dòng nào đang có: Postgres thêm một cột
-- NULL không cần viết lại bảng.
-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "logoKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarKey" TEXT;

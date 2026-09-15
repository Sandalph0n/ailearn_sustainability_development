-- Trước đây email auto-grant chỉ cho vai trò cấp INSTITUTION, vì nó chạy lúc người dùng gia nhập
-- trường, khi chưa có offering nào trong ngữ cảnh request.
--
-- Chủ đích nay đã đổi: cho phép cả vai trò cấp OFFERING mang `autoGrantEmailRegex`, để email sinh
-- viên tự cấp thẳng vai trò `offering:student`. Assignment sinh ra ở trạng thái chưa gắn môn —
-- hợp lệ, vì offering nằm ở `ScopeAssignment` riêng chứ không trên `RoleAssignment`. Bỏ ràng buộc
-- CHECK từng khoá luật cũ.
ALTER TABLE "Role"
DROP CONSTRAINT IF EXISTS "Role_auto_grant_institution_scope_check";

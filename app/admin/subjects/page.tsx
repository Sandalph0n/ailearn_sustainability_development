import { redirect } from 'next/navigation';

/**
 * Subject không có phạm vi toàn hệ thống. Giữ redirect để bookmark cũ không thành 404, nhưng
 * mọi thao tác đều bắt đầu từ một institution cụ thể.
 */
export default function AdminSubjectsRedirect() {
    redirect('/admin/institutions');
}

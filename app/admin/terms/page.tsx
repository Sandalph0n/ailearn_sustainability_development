import { redirect } from 'next/navigation';

/** Study term chỉ có nghĩa bên trong một institution; đây là lối chuyển cho URL cũ. */
export default function AdminTermsRedirect() {
    redirect('/admin/institutions');
}

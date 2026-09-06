// File này sinh và kiểm khoá của ảnh trong bucket `media`. Không import gì từ kho tệp, nên
// test được mà không cần MinIO chạy.
import { randomBytes } from 'node:crypto';

/**
 * ─── Vì sao khoá có phần ngẫu nhiên ──────────────────────────────────────────
 *
 * `avatar/<userId>` là đủ duy nhất rồi. Nhưng khoá cố định nghĩa là đổi ảnh mà ĐỊA CHỈ KHÔNG
 * ĐỔI, và trình duyệt đánh dấu bản sao trong máy theo địa chỉ — nó sẽ tiếp tục hiện ảnh cũ.
 *
 * Thêm phần ngẫu nhiên thì mỗi lần tải lên là một địa chỉ mới. Trình duyệt thấy lạ nên tải về;
 * còn địa chỉ cũ không ai hỏi tới nữa vì database đã trỏ sang khoá mới. Nhờ vậy khai báo
 * "giữ bản sao một năm" là an toàn tuyệt đối — mỗi ảnh tải đúng một lần trong đời.
 *
 * ─── Vì sao KHÔNG có phần mở rộng tệp ────────────────────────────────────────
 *
 * Kiểu nội dung nằm trong siêu dữ liệu của đối tượng, do lúc ghi khai. Nhét thêm `.png` vào khoá
 * là mô tả cùng một điều ở hai nơi, và chúng sẽ lệch nhau ngay lần đầu ai đó đổi ảnh.
 */
const SUFFIX_BYTES = 8;

function randomSuffix(): string {
    return randomBytes(SUFFIX_BYTES).toString('hex');
}

export function newAvatarKey(userId: string): string {
    return `avatar/${userId}/${randomSuffix()}`;
}

export function newLogoKey(institutionId: string): string {
    return `logo/${institutionId}/${randomSuffix()}`;
}

/**
 * Khoá này có đúng hình dạng do ta sinh ra không?
 *
 * ─── Vì sao cần kiểm ─────────────────────────────────────────────────────────
 *
 * Route phục vụ ảnh nhận khoá TỪ URL, tức là từ người dùng. Không kiểm thì ai cũng đọc được mọi
 * đối tượng trong bucket `media` bằng cách gõ khoá bất kỳ.
 *
 * Biểu thức dưới đây chỉ chấp nhận đúng ba đoạn với đúng bảng chữ cái đã dùng khi sinh, nên nó
 * đồng thời chặn luôn `..` và mọi thứ khác lạ.
 */
const MEDIA_KEY_PATTERN = /^(?:avatar|logo)\/[0-9a-f-]{36}\/[0-9a-f]{16}$/;

export function isMediaKey(value: string): boolean {
    return MEDIA_KEY_PATTERN.test(value);
}

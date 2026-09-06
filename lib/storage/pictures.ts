// File này giữ THỨ TỰ GHI khi thay hoặc gỡ một tấm ảnh. Đúng một chỗ, để không nơi nào tự nghĩ lại.
import 'server-only';

import type { ImageContentType } from '@/lib/storage/image';
import { deleteObject, putObject } from '@/lib/storage/objects';

/**
 * Hàm ghi khoá mới xuống database. Mỗi bảng một câu lệnh khác nhau, nên chỗ gọi truyền vào.
 *
 * `null` nghĩa là gỡ ảnh.
 */
type SavePointer = (key: string | null) => Promise<void>;

/**
 * ─── VÌ SAO THỨ TỰ NÀY ───────────────────────────────────────────────────────
 *
 * Kho tệp không có transaction, và giữa kho tệp với database thì càng không. Không thể "ghi tệp
 * và ghi dòng, cả hai cùng thành công hoặc cùng thất bại". Chỉ chọn được kiểu hỏng nào đỡ đau hơn.
 *
 *   1. Ghi đối tượng MỚI
 *   2. Trỏ database sang khoá mới
 *   3. Xoá đối tượng CŨ
 *
 * Hỏng giữa 1 và 2 để lại một đối tượng mồ côi — rác, quét được, không ai thấy.
 * Hỏng giữa 2 và 3 cũng chỉ để lại rác.
 *
 * Làm ngược lại — xoá cũ trước, hoặc ghi database trước — sẽ có lúc dòng dữ liệu trỏ vào hư
 * không, và ảnh đại diện biến mất vĩnh viễn. Đây đúng là thứ tự mà `Document` đã chốt.
 */
export async function replacePicture({
    previousKey,
    nextKey,
    bytes,
    contentType,
    savePointer,
}: {
    previousKey: string | null;
    nextKey: string;
    bytes: Uint8Array;
    contentType: ImageContentType;
    savePointer: SavePointer;
}): Promise<void> {
    await putObject({ bucket: 'media', key: nextKey, body: bytes, contentType });
    await savePointer(nextKey);
    await sweep(previousKey, nextKey);
}

/** Gỡ ảnh: cắt con trỏ trước, rồi mới dọn. Ngược lại thì có khoảnh khắc trỏ vào chỗ trống. */
export async function removePicture({
    previousKey,
    savePointer,
}: {
    previousKey: string | null;
    savePointer: SavePointer;
}): Promise<void> {
    await savePointer(null);
    await sweep(previousKey, null);
}

/**
 * Dọn đối tượng cũ. Nuốt lỗi có chủ ý: tới bước này database đã đúng, và người dùng đã có ảnh
 * mới. Ném lỗi ra chỉ khiến giao diện báo "thất bại" cho một thao tác đã thành công — trong khi
 * cái để lại chỉ là một tệp thừa.
 */
async function sweep(previousKey: string | null, nextKey: string | null): Promise<void> {
    if (!previousKey || previousKey === nextKey) return;

    try {
        await deleteObject({ bucket: 'media', key: previousKey });
    } catch {
        // Rác nằm lại trong bucket `media`. Một job quét đối chiếu sẽ dọn sau.
    }
}

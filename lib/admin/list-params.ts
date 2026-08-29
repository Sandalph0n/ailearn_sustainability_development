// File này đọc và kiểm tham số URL của các bảng danh sách trong khu quản trị.
import { z } from 'zod';

/** Số dòng mỗi trang. Một con số cho cả khu quản trị, không để mỗi bảng một kiểu. */
export const PAGE_SIZE = 10;

/**
 * Tham số điều khiển một bảng danh sách, đọc từ query string.
 *
 * ─── Vì sao trạng thái nằm ở URL chứ không ở `useState` ─────────────────────
 *
 * Đây là lý do chính, và nó không phải hiệu năng: **URL chính là trạng thái**. Kết quả tìm kiếm
 * chia sẻ được cho người khác, đánh dấu được, F5 không mất, và nút Back của trình duyệt quay lại
 * đúng bộ lọc trước đó. Giữ trong `useState` thì không thứ nào trong số đó hoạt động.
 *
 * Hệ quả kèm theo cũng đáng: Postgres lọc bằng index thay vì JavaScript duyệt mảng, và chỉ một
 * trang dữ liệu đi qua đường truyền thay vì cả bảng.
 *
 * ─── Vì sao phải KIỂM, không đọc thẳng ──────────────────────────────────────
 *
 * Query string là dữ liệu người dùng nhập. `?page=-5`, `?page=abc`, `?sort=passwordHash` đều gõ
 * được. Trường `sort` nguy hiểm nhất: nó đi thẳng vào `orderBy` của Prisma, nên phải giới hạn
 * trong danh sách cột cho phép, không bao giờ nhận chuỗi tự do.
 *
 * Mọi trường đều rơi về mặc định khi sai, thay vì báo lỗi. Một URL hỏng nên cho ra trang đầu
 * tiên, chứ không phải một màn hình lỗi.
 */
export type ListParams<TSortField extends string> = {
    q: string;
    page: number;
    sort: TSortField;
    dir: 'asc' | 'desc';
    /** Số dòng cần bỏ qua, tính sẵn cho `skip` của Prisma. */
    skip: number;
};

export function parseListParams<TSortField extends string>(
    searchParams: Record<string, string | string[] | undefined>,
    /** Các cột được phép sắp xếp. Phần tử đầu là mặc định. */
    sortFields: readonly [TSortField, ...TSortField[]],
): ListParams<TSortField> {
    const schema = z.object({
        // `catch` thay cho `default`: nó nuốt cả giá trị thiếu LẪN giá trị sai kiểu.
        q: z.string().trim().max(200).catch(''),
        page: z.coerce.number().int().min(1).catch(1),
        sort: z.enum(sortFields).catch(sortFields[0]),
        dir: z.enum(['asc', 'desc']).catch('asc'),
    });

    // Query string có thể lặp khoá (`?q=a&q=b`) và khi đó Next trả về mảng. Lấy giá trị đầu.
    const first = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value[0] : value;

    const parsed = schema.parse({
        q: first(searchParams.q),
        page: first(searchParams.page),
        sort: first(searchParams.sort),
        dir: first(searchParams.dir),
    });

    return { ...parsed, skip: (parsed.page - 1) * PAGE_SIZE };
}

/** Tổng số trang, tối thiểu 1 — bảng rỗng vẫn là "trang 1 trên 1", không phải "trên 0". */
export function pageCountOf(total: number): number {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

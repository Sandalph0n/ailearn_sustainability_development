// File này khởi tạo Prisma Client dùng chung cho toàn bộ mã chạy phía server.
import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/app/generated/prisma/client';

/**
 * Một thể hiện Prisma Client dùng chung.
 *
 * ─── Vì sao phải giữ trên `globalThis` ───────────────────────────────────────
 *
 * Next.js ở chế độ dev nạp lại module mỗi lần sửa file. Nếu `new PrismaClient()` chạy ở tầng
 * module thì mỗi lần lưu file lại mở thêm một pool kết nối, và sau vài chục lần sửa là Postgres
 * từ chối vì hết slot.
 *
 * `globalThis` sống qua các lần nạp lại đó. Chỉ làm vậy ở dev — production nạp module đúng một
 * lần nên không cần, và bám vào biến toàn cục là thứ nên tránh khi không cần.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is missing from .env');
    }

    // Prisma 7 bắt buộc dùng driver adapter — không còn engine nhị phân tự kết nối nữa.
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = db;
}

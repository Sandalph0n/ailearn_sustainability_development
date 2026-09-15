import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        // Next dùng marker này để chặn import server module vào Client Component. Trong unit test
        // ta chạy trực tiếp module server, nên thay marker cố ý-ném-lỗi bằng một module rỗng.
        alias: {
            '@': fileURLToPath(new URL('./', import.meta.url)),
            'server-only': fileURLToPath(new URL('./tests/server-only-stub.ts', import.meta.url)),
        },
    },
    test: {
        // Unit test được đặt cạnh mã nguồn. Test xuyên nhiều module hoặc E2E sẽ nằm trong `tests/`.
        // Giới hạn các thư mục do ứng dụng sở hữu để không chạy nhầm test trong mã tham khảo.
        include: [
            '{app,components,hooks,lib}/**/*.{test,spec}.{ts,tsx}',
            'tests/**/*.{test,spec}.{ts,tsx,mjs}',
        ],
    },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Unit test được đặt cạnh mã nguồn. Test xuyên nhiều module hoặc E2E sẽ nằm trong `tests/`.
        // Giới hạn các thư mục do ứng dụng sở hữu để không chạy nhầm test trong mã tham khảo.
        include: [
            '{app,components,hooks,lib}/**/*.{test,spec}.{ts,tsx}',
            'tests/**/*.{test,spec}.{ts,tsx,mjs}',
        ],
    },
});

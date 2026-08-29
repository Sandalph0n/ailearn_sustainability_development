/**
 * Chụp màn hình các trang của app đang chạy, để xem lại giao diện mà không phải mở trình duyệt.
 *
 * ─── Vì sao là script chứ không phải bộ test ─────────────────────────────────
 *
 * Đây KHÔNG phải test: nó không khẳng định điều gì và không bao giờ báo hỏng vì giao diện đổi.
 * Việc duy nhất của nó là biến một đường dẫn thành một tấm ảnh, để sửa xong là nhìn được ngay.
 * Test E2E thật sẽ viết sau, khi các trang admin đã chốt.
 *
 * ─── Cách chạy ───────────────────────────────────────────────────────────────
 *
 *     pnpm dev                                  # phải có server ở cổng 3000
 *     pnpm shot /admin /admin/roles             # ảnh nằm ở .screenshots/
 *     pnpm shot --dark /admin                   # chụp ở chế độ tối
 *     pnpm shot --no-login /                    # trang công khai, bỏ qua đăng nhập
 *     pnpm shot --width=390 /admin              # bề ngang khác, để soi responsive
 *
 * Trong Git Bash trên Windows, `/admin` bị dịch thành `C:/Program Files/Git/admin` trước khi
 * chạm tới script. Viết `admin` không có dấu gạch đầu là xong — script tự thêm lại.
 *
 * ─── Vì sao đăng nhập bằng API chứ không điền form ───────────────────────────
 *
 * Điền form thì mỗi lần đổi nhãn nút hay đổi thẻ input là script gãy, mà nó có nhiệm vụ gì với
 * cái form đâu. Gọi thẳng `POST /api/auth/login` cho ra đúng chiếc cookie ấy, và chỉ gãy khi
 * bản thân API đổi.
 *
 * `context.request` dùng CHUNG kho cookie với trang, nên `Set-Cookie` từ lần gọi này tự động
 * theo sang mọi lần điều hướng sau đó.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

const OUT_DIR = '.screenshots';
const BASE_URL = process.env.SHOT_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.SHOT_EMAIL ?? 'admintest@mq.edu.au';
const PASSWORD = process.env.SHOT_PASSWORD ?? 'matkhaurataodai';

const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith('--'));
// Chấp nhận cả `admin` lẫn `/admin`: Git Bash trên Windows nuốt mất dạng thứ hai.
const paths = args
    .filter((arg) => !arg.startsWith('--'))
    .map((arg) => (arg.startsWith('/') ? arg : `/${arg}`));

const dark = flags.includes('--dark');
const login = !flags.includes('--no-login');
const fullPage = !flags.includes('--viewport-only');
const width = Number(flags.find((f) => f.startsWith('--width='))?.slice(8) ?? 1440);

if (paths.length === 0) {
    console.error('usage: pnpm shot [--dark] [--no-login] [--width=N] [--viewport-only] <path>...');
    process.exit(1);
}

/** `/admin/institutions/abc/roles` → `admin-institutions-abc-roles`. Trang gốc thành `home`. */
function slugify(pathname) {
    return pathname.replace(/^\/|\/$/g, '').replace(/[^a-zA-Z0-9]+/g, '-') || 'home';
}

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width, height: 900 },
    // Trang đọc theme của người xem qua `prefers-color-scheme`; đây là cách duy nhất giả lập nó.
    colorScheme: dark ? 'dark' : 'light',
});

if (login) {
    const response = await context.request.post(`${BASE_URL}/api/auth/login`, {
        // Route từ chối mọi thứ không phải `application/json` — đó là một lớp chống CSRF.
        headers: { 'content-type': 'application/json' },
        data: { email: EMAIL, password: PASSWORD },
    });

    if (!response.ok()) {
        console.error(`login failed  ${response.status()}  ${await response.text()}`);
        await browser.close();
        process.exit(1);
    }
}

await mkdir(OUT_DIR, { recursive: true });
const page = await context.newPage();

// Lỗi trong console của trình duyệt KHÔNG hiện trên ảnh — một component client ném lỗi thì
// React chỉ để lại khoảng trống. Không gom lại thì tấm ảnh nói dối: trông như trang thiết kế
// hỏng, thật ra là mã hỏng.
const problems = [];
page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
});
page.on('pageerror', (error) => problems.push(String(error)));

for (const pathname of paths) {
    const url = new URL(pathname, BASE_URL).toString();
    const response = await page.goto(url, { waitUntil: 'networkidle' });

    // Ảnh chụp một trang lỗi trông y hệt ảnh chụp một trang trống, nên phải nói ra mã trạng thái.
    const status = response?.status() ?? 0;

    const file = path.join(OUT_DIR, `${slugify(pathname)}${dark ? '-dark' : ''}.png`);
    await page.screenshot({ path: file, fullPage });

    console.log(`${status}  ${pathname}  →  ${file}`);
    for (const problem of problems.splice(0)) {
        console.log(`      console error: ${problem}`);
    }
}

await browser.close();

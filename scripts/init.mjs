#!/usr/bin/env node
/**
 * `pnpm app:init` — đưa một máy vừa clone repo về trạng thái chạy được.
 *
 * Giả định duy nhất: máy đã có **pnpm** và **Docker**. Mọi thứ còn lại script này lo.
 *
 * ─── Vì sao viết bằng Node chứ không phải bash ───────────────────────────────
 *
 * Vì người tiếp theo có thể dùng Windows, và một file `.sh` sẽ không chạy ở đó. Node thì đã nằm
 * sẵn trong máy của bất kỳ ai clone dự án này — không thêm phụ thuộc nào.
 *
 * ─── Vì sao script này KHÔNG tự tạo container ────────────────────────────────
 *
 * Việc đó là của `compose.yaml`. Ở đây chỉ làm những phần Compose không làm được: kiểm tiền đề,
 * dựng `.env`, và chạy các bước Prisma theo đúng thứ tự sau khi database đã lên. Nếu gọi
 * `docker create` ở đây thì cùng một việc được mô tả ở hai nơi, và chúng sẽ lệch nhau.
 *
 * ─── Chạy lại bao nhiêu lần cũng được ────────────────────────────────────────
 *
 * Mỗi bước tự kiểm rồi bỏ qua nếu đã xong. Không có bước nào phá thứ đang có.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const skip = (m) => console.log(`\x1b[2m·\x1b[0m ${m}`);
const step = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const die = (m, hint) => {
    console.error(`\n\x1b[31m✗ ${m}\x1b[0m`);
    if (hint) console.error(`  ${hint}`);
    process.exit(1);
};

/**
 * Chạy một lệnh, để output chảy thẳng ra terminal.
 *
 * `shell: true` trên Windows là bắt buộc: ở đó `pnpm` là file `.cmd`, mà `spawnSync` không gọi
 * được `.cmd` nếu không qua shell.
 */
function run(cmd, args, { quiet = false } = {}) {
    const r = spawnSync(cmd, args, {
        cwd: root,
        stdio: quiet ? 'ignore' : 'inherit',
        shell: process.platform === 'win32',
    });
    return r.status === 0;
}

console.log('\n\x1b[1mAI-Learn — khởi tạo môi trường dev\x1b[0m\n');

// ─── 1. Phụ thuộc ────────────────────────────────────────────────────────────
//
// Phải là bước ĐẦU TIÊN: các bước sau gọi `prisma`, mà nó chỉ tồn tại sau khi cài. Lệnh
// `pnpm run` thì chạy được ngay cả khi chưa có `node_modules`, nên vòng lặp này không bị kẹt.
if (existsSync(join(root, 'node_modules'))) {
    skip('node_modules đã có');
} else {
    step('cài phụ thuộc…');
    if (!run('pnpm', ['install'])) die('pnpm install thất bại.');
    ok('phụ thuộc đã cài');
}

// ─── 2. Docker ───────────────────────────────────────────────────────────────
//
// `docker info` thất bại khi Docker chưa cài HOẶC daemon chưa chạy. Gộp hai trường hợp vào một
// thông báo là đủ, vì cách xử lý giống nhau: mở Docker Desktop lên.
if (!run('docker', ['info'], { quiet: true })) {
    die('Docker không phản hồi.', 'Mở Docker Desktop, đợi nó khởi động xong rồi chạy lại lệnh này.');
}
ok('Docker đang chạy');

// ─── 3. .env ─────────────────────────────────────────────────────────────────
//
// KHÔNG ghi đè file đã có: người dùng có thể đã đổi cổng hoặc trỏ sang database khác, đè lên là
// phá âm thầm — thứ tệ hơn cả báo lỗi.
const envPath = join(root, '.env');
if (existsSync(envPath)) {
    skip('.env đã có, giữ nguyên');
} else {
    copyFileSync(join(root, '.env.example'), envPath);
    ok('.env tạo từ .env.example');
}

// ─── 4. Postgres ─────────────────────────────────────────────────────────────
//
// `--wait` đọc `healthcheck` trong compose.yaml, nên dòng này chỉ trả về khi Postgres THẬT SỰ
// nhận kết nối — không phải khi container vừa được đánh dấu là đang chạy. Thiếu cờ đó thì bước
// migration ngay dưới sẽ thỉnh thoảng lỗi `connection refused`, và chỉ trên máy chậm.
step('dựng Postgres (lần đầu phải tải image, hơi lâu)…');
if (!run('docker', ['compose', 'up', '-d', '--wait'])) {
    die('Không dựng được Postgres.', 'Xem chi tiết: pnpm db:logs');
}
ok('Postgres sẵn sàng ở localhost:5432');

// ─── 5. Prisma Client ────────────────────────────────────────────────────────
//
// Bắt buộc, không phải tuỳ chọn: `app/generated/prisma` bị gitignore nên máy vừa clone về chưa
// có gì cả, và TypeScript sẽ đỏ toàn bộ cho tới khi chạy bước này.
step('sinh Prisma Client…');
if (!run('pnpm', ['exec', 'prisma', 'generate'])) die('prisma generate thất bại.');
ok('Prisma Client đã sinh');

// ─── 6. Migration ────────────────────────────────────────────────────────────
//
// `migrate deploy` chứ KHÔNG phải `migrate dev`: lệnh `dev` được phép xoá và dựng lại database
// khi thấy lệch schema. Ở máy dev thì mất dữ liệu thử nghiệm, ở nơi khác thì tệ hơn nhiều.
//
// Chưa có migration nào thì bỏ qua — chạy `deploy` trên thư mục rỗng chỉ tổ ném ra một lỗi khó
// hiểu cho đúng người vừa mới vào dự án.
const migrationsDir = join(root, 'prisma', 'migrations');
const hasMigrations =
    existsSync(migrationsDir) &&
    readdirSync(migrationsDir).some((f) => !f.startsWith('.') && f !== 'migration_lock.toml');

if (hasMigrations) {
    step('áp migration…');
    if (!run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'])) die('prisma migrate deploy thất bại.');
    ok('migration đã áp');
} else {
    skip('chưa có migration nào — bỏ qua');
}

console.log('\n\x1b[32m\x1b[1mXong.\x1b[0m Chạy \x1b[1mpnpm dev\x1b[0m để bắt đầu.\n');

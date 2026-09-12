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
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
 * Các cách gọi `pnpm`, xếp theo thứ tự ưu tiên. Thử lần lượt cho tới khi có cách chạy được.
 *
 * ─── Vì sao KHÔNG có nhánh `pnpm.cmd` ────────────────────────────────────────
 *
 * Trực giác nói trên Windows nên thử thêm `pnpm.cmd`. Nhưng Node CỐ TÌNH từ chối chạy `.cmd`
 * và `.bat` khi không qua shell (bản vá bảo mật) — nó ném `EINVAL`, không phải `ENOENT`. Thêm
 * nhánh đó vào chỉ là mã chết trông như đang làm việc gì đó.
 *
 * Trường hợp cần tới nó — Windows cài pnpm bằng npm/corepack — thì `npm_execpath` bên dưới đã
 * xử lý, vì script này luôn được chính pnpm chạy.
 */
function pnpmCandidates(args) {
    const list = [];
    const exec = process.env.npm_execpath;

    // 1. Chính xác nhất: pnpm đang chạy script này tự khai nó nằm đâu. Không cần đoán qua PATH.
    if (exec) {
        list.push(/\.(c?js|mjs)$/i.test(exec) ? [process.execPath, [exec, ...args]] : [exec, args]);
    }

    // 2. Tra PATH. Dùng khi ai đó chạy thẳng `node scripts/init.mjs`.
    list.push(['pnpm', args]);

    return list;
}

function dockerCandidates(args) {
    const list = [['docker', args]];
    if (process.platform === 'win32') {
        const dockerDesktopCli = join(
            process.env.ProgramFiles ?? 'C:\\Program Files',
            'Docker',
            'Docker',
            'resources',
            'bin',
            'docker.exe',
        );
        if (existsSync(dockerDesktopCli)) list.push([dockerDesktopCli, args]);
    }
    return list;
}

/**
 * Chạy một lệnh, để output chảy thẳng ra terminal.
 *
 * ─── Vì sao không dùng `shell: true` ─────────────────────────────────────────
 *
 * Cách hiển nhiên trên Windows là bật `shell: true` để gọi được `pnpm.cmd`. Nhưng khi có shell,
 * Node NỐI các tham số thành một chuỗi mà KHÔNG bọc dấu nháy — Node 24 cảnh báo đúng chuyện này
 * (DEP0190), và sẽ thành lỗi ở bản sau.
 *
 * Hiện mọi tham số ở đây đều là hằng số nên vô hại. Nhưng đường dẫn dự án có khoảng trắng, nên
 * ngày nào đó truyền một đường dẫn vào là vỡ, theo kiểu rất khó lần ra.
 */
function run(cmd, args, { quiet = false } = {}) {
    const opts = { cwd: root, stdio: quiet ? 'ignore' : 'inherit' };
    const attempts =
        cmd === 'pnpm'
            ? pnpmCandidates(args)
            : cmd === 'docker'
              ? dockerCandidates(args)
              : [[cmd, args]];

    for (const [file, argv] of attempts) {
        const r = spawnSync(file, argv, opts);
        // `error` nghĩa là KHÔNG GỌI ĐƯỢC (không tìm thấy, bị từ chối) — khác hẳn với lệnh chạy
        // rồi thất bại. Trường hợp đầu thì thử cách gọi khác; trường hợp sau mới là lỗi thật.
        if (r.error) continue;
        return r.status === 0;
    }

    console.error(`\x1b[31m✗ không gọi được \`${cmd}\`.\x1b[0m`);
    if (cmd === 'pnpm') console.error('  Chạy bằng `pnpm app:init` thay vì `node scripts/init.mjs`.');
    return false;
}

console.log('\n\x1b[1mLernumi — khởi tạo môi trường dev\x1b[0m\n');

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

// File .env cũ được giữ nguyên ở trên, nhưng một biến bảo mật mới không thể có default trong mã
// nguồn. Bổ sung riêng biến còn thiếu; tuyệt đối không thay giá trị người dùng đã cấu hình.
let envContents = readFileSync(envPath, 'utf8');
const toolSecretLine = envContents.match(/^TOOL_TOKEN_SECRET\s*=\s*(.*)$/m);
const configuredToolSecret = toolSecretLine?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2') ?? '';

if (configuredToolSecret && new TextEncoder().encode(configuredToolSecret).byteLength < 32) {
    die('TOOL_TOKEN_SECRET quá ngắn.', 'Đặt một chuỗi ngẫu nhiên ít nhất 32 byte trong .env.');
}

if (configuredToolSecret) {
    skip('TOOL_TOKEN_SECRET đã có, giữ nguyên');
} else {
    const generatedToolSecret = randomBytes(48).toString('base64url');
    const separator = envContents.length === 0 || /\r?\n$/.test(envContents) ? '' : '\n';
    envContents = toolSecretLine
        ? envContents.replace(/^TOOL_TOKEN_SECRET\s*=.*$/m, `TOOL_TOKEN_SECRET="${generatedToolSecret}"`)
        : `${envContents}${separator}\n# JWT ngắn hạn cho web tool; tự sinh bởi app:init.\nTOOL_TOKEN_SECRET="${generatedToolSecret}"\n`;
    writeFileSync(envPath, envContents, 'utf8');
    ok('TOOL_TOKEN_SECRET đã được sinh và thêm vào .env');
}

// ─── 4. Hạ tầng: Postgres + kho tệp ──────────────────────────────────────────
//
// `--wait` đọc `healthcheck` của TỪNG service trong compose.yaml, nên dòng này chỉ trả về khi cả
// hai thật sự nhận kết nối — không phải khi container vừa được đánh dấu là đang chạy. Thiếu cờ
// đó thì bước migration ngay dưới sẽ thỉnh thoảng lỗi `connection refused`, và chỉ trên máy chậm.
step('dựng Postgres và kho tệp (lần đầu phải tải image, hơi lâu)…');
if (!run('docker', ['compose', 'up', '-d', '--wait'])) {
    die('Không dựng được hạ tầng.', 'Xem chi tiết: pnpm infra:logs');
}
ok('Postgres ở localhost:5432 · kho tệp ở localhost:9000');

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

// ─── 7. Bucket trong kho tệp ─────────────────────────────────────────────────
//
// ─── Vì sao tạo ở đây chứ không phải trong compose.yaml ──────────────────────
//
// Cách thường thấy là thêm một container `mc` chạy một lần rồi thoát. Nhưng service kiểu
// chạy-rồi-chết làm `--wait` khó xử: nó chờ trạng thái khoẻ mạnh, mà thứ đã thoát thì không
// khoẻ cũng không ốm.
//
// Ở đây chỉ là một lời gọi API, và dùng đúng SDK mà ứng dụng sẽ dùng — nên cấu hình sai thì
// hỏng ngay tại bước này, chứ không phải hỏng lúc người dùng đầu tiên tải tệp lên.
/**
 * Bốn bucket, khai ở đây vì `.env` chỉ nói được TÊN, không nói được chính sách.
 *
 * ─── Vì sao chỉ `archive` bật Object Lock ────────────────────────────────────
 *
 * Object Lock là cơ chế WORM của S3: ghi một lần, không xoá được cho tới ngày đã hẹn. Nó dành
 * cho bản lưu trữ buổi làm bài — thứ mà cả dự án dựa vào để nói "chuỗi thao tác này chưa bị ai
 * sửa". Ba bucket còn lại chứa dữ liệu đời thường, khoá lại chỉ tổ vướng.
 *
 * ─── Vì sao phải quyết NGAY LÚC TẠO ──────────────────────────────────────────
 *
 * Object Lock KHÔNG bật được cho bucket đã tồn tại. MinIO trả về:
 *
 *     409 InvalidBucketState
 *     "Object Lock configuration cannot be enabled on existing buckets"
 *
 * Sai ở đây thì cách sửa duy nhất là tạo bucket khác rồi chép toàn bộ sang — mà chép xong thì
 * mọi mốc thời gian đều mới, đúng thứ mà bản lưu trữ tồn tại để chứng minh.
 *
 * Ngược lại, CHẾ ĐỘ khoá (`GOVERNANCE` phá được / `COMPLIANCE` không ai phá được) thì đổi lúc
 * nào cũng được, và mỗi tệp còn tự khai riêng lúc ghi. Nên ở đây chỉ bật cơ chế, chưa đặt luật.
 */
const BUCKETS = [
    { env: 'S3_BUCKET_MEDIA', objectLock: false },
    { env: 'S3_BUCKET_DOCS', objectLock: false },
    { env: 'S3_BUCKET_TOOLS', objectLock: false },
    { env: 'S3_BUCKET_ARCHIVE', objectLock: true },
];

async function ensureBuckets() {
    // Nạp `.env` TẠI ĐÂY, không phải ở đầu file: bước 3 mới vừa tạo ra nó. Nạp sớm hơn thì trên
    // máy mới file chưa tồn tại và mọi biến sẽ rỗng.
    const dotenv = await import('dotenv');
    dotenv.config({ path: join(root, '.env'), quiet: true });

    const { S3Client, HeadBucketCommand, CreateBucketCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
        region: process.env.S3_REGION ?? 'us-east-1',
        endpoint: process.env.S3_ENDPOINT,
        // Bắt buộc với MinIO: nó nhận `host/bucket`, không nhận `bucket.host` như AWS.
        forcePathStyle: true,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
        },
    });

    for (const { env, objectLock } of BUCKETS) {
        const bucket = process.env[env];
        if (!bucket) die(`Thiếu ${env} trong .env.`, 'Đối chiếu với .env.example.');

        let exists = true;
        try {
            await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        } catch (err) {
            // 404 = chưa có, tạo tiếp bên dưới. Lỗi khác là vấn đề thật, đừng nuốt.
            const code = err?.$metadata?.httpStatusCode;
            if (code !== 404 && err?.name !== 'NotFound' && err?.name !== 'NoSuchBucket') {
                die(`Không nối được kho tệp: ${err?.name ?? err}`, 'Xem chi tiết: pnpm infra:logs');
            }
            exists = false;
        }

        if (exists) {
            skip(`bucket "${bucket}" đã có`);
            continue;
        }

        await s3.send(
            new CreateBucketCommand({
                Bucket: bucket,
                // Bật Object Lock kéo theo versioning — S3 bắt buộc, không tách rời được.
                ...(objectLock ? { ObjectLockEnabledForBucket: true } : {}),
            }),
        );
        ok(`bucket "${bucket}" đã tạo${objectLock ? ' (Object Lock)' : ''}`);
    }
}

await ensureBuckets();

console.log('\n\x1b[32m\x1b[1mXong.\x1b[0m Chạy \x1b[1mpnpm dev\x1b[0m để bắt đầu.\n');

# AI-Learn

Nền tảng học tập đa cơ sở giáo dục. Xem [Project Plan.md](./Project%20Plan.md) để biết phạm vi và kiến trúc.

Nhà phát triển công cụ xem [Tool Platform Contract](./docs/tool-platform/README.md),
[OpenAPI v1](./docs/tool-platform/openapi.yaml), và [schema của `tool.json`](./docs/tool-platform/tool.schema.json).

## Bắt đầu

Cần sẵn: **pnpm**, **Docker Desktop đang chạy**, và Node 20+.

```bash
git clone <repo>
cd ailearn_sustainability_development
pnpm app:init
pnpm dev
```

`app:init` làm tất cả: cài phụ thuộc, kiểm Docker, tạo hoặc bổ sung biến bảo mật còn thiếu trong
`.env`, dựng Postgres rồi **chờ tới khi nó thật sự nhận kết nối**, sinh Prisma Client, áp migration.

Chạy lại bao nhiêu lần cũng được — mỗi bước tự bỏ qua nếu đã xong, và **`.env` đã có thì không bị ghi đè** (bạn đổi cổng hay trỏ sang database khác thì vẫn giữ nguyên).

## Các lệnh

| Lệnh | Việc |
|---|---|
| `pnpm app:init` | Khởi tạo toàn bộ môi trường dev |
| `pnpm dev` | Chạy Next.js (nhớ `pnpm infra:up` trước nếu hạ tầng đang tắt) |
| `pnpm infra:up` | Bật Postgres + kho tệp, chờ tới khi cả hai nhận kết nối |
| `pnpm infra:down` | Tắt cả hai — **dữ liệu còn nguyên** |
| `pnpm infra:reset` | **Xoá sạch dữ liệu** rồi dựng lại |
| `pnpm infra:logs` | Xem log hạ tầng |
| `pnpm db:psql` | Mở psql trong container |
| `pnpm db:generate` | Sinh lại Prisma Client |
| `pnpm db:studio` | Mở Prisma Studio |
| `pnpm db:seed` | Chạy lần lượt mọi file SQL trong `prisma/seedingdata` |
| `pnpm seed:mq:fetch` | Tải Handbook + Unit Guides 2026 và chuẩn hóa thành CSV |
| `pnpm seed:mq:generate` | Kiểm định CSV rồi sinh lại các file SQL Macquarie |
| `pnpm storage:console` | In địa chỉ trình duyệt tệp MinIO |

## Hạ tầng dev

| | Địa chỉ | |
|---|---|---|
| Postgres | `localhost:5432` | `postgres` / `dev` / db `ailearn` |
| Kho tệp (S3) | `localhost:9000` | `ailearn` / `ailearn-dev-secret` |
| Trình duyệt tệp | `localhost:9001` | mở bằng trình duyệt web |

Kho tệp nói giao thức S3, nên khi lên AWS chỉ cần **xoá `S3_ENDPOINT`** khỏi `.env` — SDK tự tìm S3 thật, mã nguồn không đổi dòng nào.

## Cấu trúc

```
app/                     Next.js App Router
lib/db.ts                PrismaClient dùng chung
prisma/
  schema/
    schema.prisma        generator + datasource
    models/              mỗi bảng một file
  migrations/
  seedingdata/           SQL dữ liệu mẫu, chạy theo thứ tự tên file
scripts/init.mjs         thứ mà app:init chạy
scripts/seed-demo.mjs    tìm và chạy các file trong seedingdata
compose.yaml             hạ tầng dev (Postgres + kho tệp MinIO)
```

File seed có phụ thuộc nên dùng tiền tố số như `001-users.sql`, `010-institutions.sql`. Toàn bộ
lượt seed chạy trong một transaction: một file lỗi thì dữ liệu của cả lượt được rollback.

### Dữ liệu công khai Macquarie

Pipeline Macquarie có hai giai đoạn tách biệt để dữ liệu tải về có thể được kiểm tra trước khi
chạm tới SQL:

1. `pnpm seed:mq:fetch` đọc Handbook và Unit Guides công khai, rồi ghi các bảng chuẩn hóa vào
   `prisma/seedingdata/source/mq-2026/`.
2. `pnpm seed:mq:generate` kiểm tra khóa, quan hệ, tổng trọng số và quy tắc ngày, rồi sinh các file
   `010-mq-institution.sql` đến `050-mq-assessments.sql`.
3. `pnpm db:seed` thực thi toàn bộ SQL theo thứ tự tên file.

Assessment luôn giữ nguyên nhãn hạn nộp công khai trong `expectedDue`. Chỉ nhãn chứa ngày đúng
dạng `dd/mm/yyyy` mới có `dueAt`, đặt vào 23:59 ngày đó theo múi giờ Australia/Sydney.

## Vài chỗ dễ vấp

**`prisma.config.ts` trỏ vào THƯ MỤC `prisma/schema`, không phải một file.** Prisma ghép mọi `.prisma` bên trong lại — đó là thứ cho phép tách mỗi bảng ra một file. Hệ quả: file `.prisma` nào đặt trong đó cũng bị đọc, kể cả khi bạn chỉ định để nó làm tài liệu tham khảo.

**`app/generated/prisma` bị gitignore.** Máy vừa clone về sẽ đỏ TypeScript cho tới khi chạy `pnpm db:generate` (hoặc `pnpm app:init`).

**Prisma 7 sinh ra TypeScript, không phải JavaScript.** Generator `prisma-client` (khác `prisma-client-js` đời cũ) xuất `.ts` để bundler tự biên dịch. Script chạy bằng `node` trần sẽ không import được — dùng `tsx`, hoặc để Next.js lo.

**Biến `POSTGRES_*` trong `compose.yaml` chỉ có tác dụng lần đầu**, lúc Postgres chạy `initdb`. Đổi mật khẩu hay tên database sau đó rồi `up` lại thì **không có gì thay đổi** và cũng không có báo lỗi nào. Muốn đổi thật thì `pnpm infra:reset` (mất dữ liệu) hoặc sửa bằng SQL.

**Đừng dùng `docker volume prune`.** Nó xoá mọi volume mồ côi trên máy, kể cả của dự án khác. Cần dọn thì liệt kê bằng `docker volume ls -f dangling=true` rồi xoá đích danh từng cái bằng `docker volume rm <tên>`.

# AI-Learn

Nền tảng học tập đa cơ sở giáo dục. Xem [Project Plan.md](./Project%20Plan.md) để biết phạm vi và kiến trúc.

## Bắt đầu

Cần sẵn: **pnpm**, **Docker Desktop đang chạy**, và Node 20+.

```bash
git clone <repo>
cd ailearn_sustainability_development
pnpm app:init
pnpm dev
```

`app:init` làm tất cả: cài phụ thuộc, kiểm Docker, tạo `.env`, dựng Postgres rồi **chờ tới khi nó thật sự nhận kết nối**, sinh Prisma Client, áp migration.

Chạy lại bao nhiêu lần cũng được — mỗi bước tự bỏ qua nếu đã xong, và **`.env` đã có thì không bị ghi đè** (bạn đổi cổng hay trỏ sang database khác thì vẫn giữ nguyên).

## Các lệnh

| Lệnh | Việc |
|---|---|
| `pnpm app:init` | Khởi tạo toàn bộ môi trường dev |
| `pnpm dev` | Chạy Next.js (nhớ `pnpm db:up` trước nếu database đang tắt) |
| `pnpm db:up` | Bật Postgres, chờ tới khi nhận được kết nối |
| `pnpm db:down` | Tắt Postgres — **dữ liệu còn nguyên** |
| `pnpm db:reset` | **Xoá sạch dữ liệu** rồi dựng lại |
| `pnpm db:logs` | Xem log Postgres |
| `pnpm db:psql` | Mở psql trong container |
| `pnpm db:generate` | Sinh lại Prisma Client |
| `pnpm db:studio` | Mở Prisma Studio |

## Cấu trúc

```
app/                     Next.js App Router
lib/db.ts                PrismaClient dùng chung
prisma/
  schema/
    schema.prisma        generator + datasource
    models/              mỗi bảng một file
  migrations/
scripts/init.mjs         thứ mà app:init chạy
compose.yaml             hạ tầng dev (Postgres)
```

## Vài chỗ dễ vấp

**`prisma.config.ts` trỏ vào THƯ MỤC `prisma/schema`, không phải một file.** Prisma ghép mọi `.prisma` bên trong lại — đó là thứ cho phép tách mỗi bảng ra một file. Hệ quả: file `.prisma` nào đặt trong đó cũng bị đọc, kể cả khi bạn chỉ định để nó làm tài liệu tham khảo.

**`app/generated/prisma` bị gitignore.** Máy vừa clone về sẽ đỏ TypeScript cho tới khi chạy `pnpm db:generate` (hoặc `pnpm app:init`).

**Prisma 7 sinh ra TypeScript, không phải JavaScript.** Generator `prisma-client` (khác `prisma-client-js` đời cũ) xuất `.ts` để bundler tự biên dịch. Script chạy bằng `node` trần sẽ không import được — dùng `tsx`, hoặc để Next.js lo.

**Biến `POSTGRES_*` trong `compose.yaml` chỉ có tác dụng lần đầu**, lúc Postgres chạy `initdb`. Đổi mật khẩu hay tên database sau đó rồi `up` lại thì **không có gì thay đổi** và cũng không có báo lỗi nào. Muốn đổi thật thì `pnpm db:reset` (mất dữ liệu) hoặc sửa bằng SQL.

**Đừng dùng `docker volume prune`.** Nó xoá mọi volume mồ côi trên máy, kể cả của dự án khác. Cần dọn thì liệt kê bằng `docker volume ls -f dangling=true` rồi xoá đích danh từng cái bằng `docker volume rm <tên>`.

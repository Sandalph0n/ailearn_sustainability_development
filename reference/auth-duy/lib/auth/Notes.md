# Auth Notes

Folder này chứa phần authentication phía server. Nó chịu trách nhiệm:

- xác minh email và password;
- tạo, đọc và thu hồi database session;
- đặt session token trong cookie bảo mật;
- kiểm tra dữ liệu đầu vào của auth API;
- chuẩn hóa JSON response và error;
- chặn các POST request đến từ origin không hợp lệ.

Folder này **không chứa UI** và **không quyết định role của user trong môn học**. Role `STUDENT`, `TUTOR`, `CONVENOR` phải được đọc từ bảng `Membership` theo từng `Offering`.

## Cấu trúc

```text
lib/auth/
├── http/
│   ├── request.ts             Đọc JSON, giới hạn body và kiểm tra same-origin
│   ├── request.test.ts        Test các quy tắc xử lý request
│   └── response.ts            Chuẩn hóa JSON success/error response
├── password/
│   ├── hash.ts                Hash và verify password bằng Argon2id
│   └── hash.test.ts           Test password hashing
├── session/
│   ├── config.ts              Tên cookie, thời hạn và cookie options
│   ├── service.ts             Vòng đời database session và cookie
│   ├── token.ts               Sinh token và băm token bằng SHA-256
│   └── token.test.ts          Test session token
└── validation/
    ├── credentials.ts         Schema register/login bằng Zod
    └── credentials.test.ts    Test validation và normalization
```

Các HTTP entry point nằm ở `app/api/auth/`:

```text
app/api/auth/
├── register/route.ts
├── login/route.ts
├── session/route.ts
├── logout/route.ts
└── logout-all/route.ts
```

## Nguồn dữ liệu

Auth bám trực tiếp vào hai model:

- `prisma/schema/models/auth/User.prisma`
- `prisma/schema/models/auth/Session.prisma`

`User.passwordHash` chứa Argon2id hash, không chứa password gốc.

`Session.tokenHash` chứa SHA-256 của session token, không chứa token gốc. Token gốc chỉ tồn tại trong cookie của browser.

Một user có thể có nhiều session cùng lúc, tương ứng với nhiều browser hoặc thiết bị.

## Luồng đăng ký

Entry point: `app/api/auth/register/route.ts`.

```text
POST /api/auth/register
        │
        ├── kiểm tra origin và JSON body
        ├── validate + normalize dữ liệu
        ├── kiểm tra Institution và email
        ├── hash password bằng Argon2id
        ├── transaction: tạo User + Session
        └── đặt session token vào cookie
```

Request body:

```json
{
  "email": "student@example.com",
  "password": "a-password-with-at-least-12-characters",
  "firstName": "Alex",
  "lastName": "Nguyen",
  "institutionId": "00000000-0000-4000-8000-000000000000"
}
```

Đăng ký thành công trả `201` và tự đăng nhập user vừa tạo.

## Luồng đăng nhập

Entry point: `app/api/auth/login/route.ts`.

```text
POST /api/auth/login
        │
        ├── kiểm tra origin và JSON body
        ├── validate + normalize dữ liệu
        ├── tìm User theo email
        ├── verify password
        ├── nâng cấp password hash nếu cấu hình đã cũ
        ├── thu hồi session cũ của browser hiện tại
        ├── tạo database session mới
        └── đặt cookie mới
```

Email không tồn tại và password không đúng cùng trả một lỗi `INVALID_CREDENTIALS`. Không trả lỗi khác nhau vì điều đó có thể làm lộ email nào đã đăng ký.

## Luồng xác thực request

Entry point mẫu: `app/api/auth/session/route.ts`.

```text
Cookie lernumi_session
        │
        ├── đọc token gốc
        ├── SHA-256 token
        ├── tìm Session theo tokenHash
        ├── kiểm tra expiresAt > thời điểm hiện tại
        └── lấy User qua relation Session.user
```

Hàm chính cho code phía server:

```ts
import { getCurrentSession } from '@/lib/auth/session/service';

const currentSession = await getCurrentSession();

if (!currentSession) {
    // Trả 401 hoặc redirect tùy entry point.
}

const userId = currentSession.user.id;
```

`getCurrentSession()` chỉ xác nhận user là ai. Trước khi đọc hoặc sửa resource, code gọi hàm này vẫn phải kiểm tra user có quyền với resource đó hay không.

## Logout

`POST /api/auth/logout`:

- xóa đúng dòng `Session` của browser hiện tại;
- xóa cookie hiện tại;
- có tính idempotent và trả `204`.

`POST /api/auth/logout-all`:

- tìm user từ session hiện tại;
- xóa mọi dòng `Session` có cùng `userId`;
- làm các thiết bị khác mất quyền truy cập ngay ở request tiếp theo;
- trả `401` nếu session hiện tại không hợp lệ.

## Cookie

Cookie hiện tại có tên `lernumi_session` và được đặt với:

- `HttpOnly`: JavaScript phía client không đọc được token;
- `Secure`: bật trong production;
- `SameSite=Lax`: giảm nguy cơ CSRF;
- `Path=/`: dùng cho toàn ứng dụng;
- `Expires`: khớp với `Session.expiresAt` trong database.

Thời hạn mặc định là 7 ngày. Có thể cấu hình trong `.env`:

```dotenv
AUTH_SESSION_TTL_DAYS="7"
```

Giá trị hợp lệ là số nguyên từ 1 đến 90.

## Validation

Register:

- email được trim và chuyển thành lowercase;
- password dài từ 12 đến 128 ký tự và không bị trim;
- first name và last name dài từ 1 đến 100 ký tự;
- `institutionId` phải là UUID;
- field không được khai báo sẽ bị từ chối.

Login không áp lại độ dài tối thiểu 12 ký tự để account cũ vẫn có thể đăng nhập và nâng cấp password sau này.

Auth request phải có `Content-Type: application/json` và body không được vượt quá 16 KiB.

## Quy tắc phải giữ

Khi sửa hoặc mở rộng auth, không được phá các invariant sau:

1. Không lưu password gốc ở bất kỳ đâu.
2. Không lưu session token gốc trong database.
3. Không trả `passwordHash` hoặc `tokenHash` qua API.
4. Không lấy `userId` hoặc role từ request body/cookie rồi tin trực tiếp.
5. Mỗi request bảo vệ dữ liệu phải xác minh session từ database.
6. Authorization phải được kiểm tra gần database query đang đọc hoặc sửa resource.
7. Không đặt role toàn cục trong `User` hoặc `Session`; role thuộc về `Membership`.
8. Không cache kết quả session giữa các request.
9. Chỉ thay đổi cookie trong Route Handler hoặc Server Action, không thay đổi trong lúc render Server Component.
10. POST auth mới phải dùng `isSameOriginRequest()` trước khi thay đổi state.

## Error response

Mọi JSON error có cùng cấu trúc:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  }
}
```

Validation error có thêm `fields`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Registration data is invalid",
    "fields": {
      "email": ["Email is invalid"]
    }
  }
}
```

UI nên dựa vào `error.code` để quyết định hành vi. `message` chỉ dùng để hiển thị hoặc debug, không nên dùng làm điều kiện logic.

## Kiểm thử

Chạy toàn bộ kiểm tra:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Test auth được đặt cạnh module tương ứng. Khi thay đổi validation, token hoặc password hashing, cần cập nhật test trong cùng folder.

## Những phần chưa có

Các tính năng sau chưa thuộc implementation hiện tại:

- email verification;
- forgot/reset password;
- thay đổi password;
- multi-factor authentication;
- OAuth/social login;
- rate limiting theo IP/account;
- giao diện quản lý danh sách thiết bị;
- job định kỳ dọn các session đã hết hạn.

Trước khi mở auth API ra public internet, cần bổ sung rate limiting ở tầng phù hợp với hạ tầng deploy. Nếu thêm state cho rate limiting trong ứng dụng, state đó phải nằm trong database hoặc dịch vụ dùng chung, không lưu bằng `Map` trong process.

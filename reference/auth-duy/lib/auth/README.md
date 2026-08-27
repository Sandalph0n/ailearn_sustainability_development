# Auth Notes

Folder này chứa authentication phía server: kiểm tra credentials, quản lý database session, đặt cookie, validate request và chuẩn hóa response. Auth hiện chỉ hỗ trợ tài khoản nội bộ bằng email/password; chưa hỗ trợ Google, Microsoft hoặc OAuth provider khác.

## Cấu trúc

```text
lib/auth/
├── http/
│   ├── request.ts             Đọc JSON, giới hạn body và kiểm tra same-origin
│   ├── request.test.ts
│   └── response.ts            Chuẩn hóa JSON success/error
├── password/
│   ├── hash.ts                Hash và verify password bằng Argon2id
│   └── hash.test.ts
├── session/
│   ├── config.ts              Tên cookie, thời hạn và cookie options
│   ├── service.ts             Vòng đời database session và cookie
│   ├── token.ts               Sinh token và băm token bằng SHA-256
│   └── token.test.ts
└── validation/
    ├── credentials.ts         Schema register/login bằng Zod
    └── credentials.test.ts
```

HTTP entry point nằm trong `app/api/auth/`:

| Method | Path | Chức năng |
|---|---|---|
| `POST` | `/api/auth/register` | Tạo User, tạo Session và đặt cookie |
| `POST` | `/api/auth/login` | Verify password và cấp Session mới |
| `GET` | `/api/auth/session` | Trả user của session hiện tại |
| `POST` | `/api/auth/logout` | Thu hồi session của browser hiện tại |
| `POST` | `/api/auth/logout-all` | Thu hồi mọi session của user |

## Luồng session

```text
Register/Login thành công
        ↓
Sinh token ngẫu nhiên 32 byte
        ↓
Lưu SHA-256(token) vào Session.tokenHash
        ↓
Lưu token gốc vào cookie HttpOnly
        ↓
Request sau gửi cookie tự động
        ↓
Server băm token và tra Session trong database
        ↓
Session còn hạn → lấy User qua Session.user
```

Database là nguồn sự thật. Cookie còn tồn tại nhưng dòng `Session` đã bị xóa hoặc hết hạn thì user vẫn bị xem là chưa đăng nhập.

Cookie hiện có tên `ailearn_session`, dùng `HttpOnly`, `SameSite=Lax`, `Path=/` và `Secure` trong production. Thời hạn mặc định là 7 ngày, cấu hình bằng:

```dotenv
AUTH_SESSION_TTL_DAYS="7"
```

Giá trị hợp lệ là số nguyên từ 1 đến 90. Session hiện có thời hạn cố định, không tự gia hạn theo hoạt động.

## Dùng trong page hoặc API khác

```ts
import { getCurrentSession } from '@/lib/auth/session/service';

const currentSession = await getCurrentSession();

if (!currentSession) {
    // Trả 401 hoặc redirect sang login tùy entry point.
}

const userId = currentSession.user.id;
```

`getCurrentSession()` chỉ trả lời user là ai. Code đọc hoặc sửa resource vẫn phải kiểm tra authorization gần database query. Role `STUDENT`, `TUTOR`, `CONVENOR` thuộc bảng `Membership` theo từng `Offering`, không thuộc `User` hoặc `Session`.

### Khi `getCurrentSession()` trả `null`

`null` nghĩa là request hiện tại không có authentication hợp lệ. Nguyên nhân có thể là chưa đăng nhập, không có cookie, token không khớp, session đã hết hạn hoặc session đã bị thu hồi.

Hàm này không tự redirect vì mỗi loại entry point cần xử lý khác nhau.

Protected page phải dừng và redirect:

```tsx
import { redirect } from 'next/navigation';

import { getCurrentSession } from '@/lib/auth/session/service';

const currentSession = await getCurrentSession();

if (!currentSession) {
    redirect('/login');
}
```

Protected API phải dừng và trả `401`:

```ts
const currentSession = await getCurrentSession();

if (!currentSession) {
    return Response.json(
        {
            error: {
                code: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication is required',
            },
        },
        { status: 401 },
    );
}
```

Public page có thể tiếp tục render giao diện anonymous:

```tsx
const currentSession = await getCurrentSession();

return currentSession ? <UserMenu user={currentSession.user} /> : <LoginButton />;
```

Không được tiếp tục query hoặc thay đổi dữ liệu riêng tư sau khi nhận `null`. Client Component không gọi trực tiếp hàm server-only này; client dùng `GET /api/auth/session` và xử lý HTTP `401`.

## Quy tắc phải giữ

1. Không lưu password gốc.
2. Không lưu session token gốc trong database.
3. Không trả `passwordHash` hoặc `tokenHash` qua API.
4. Không tin `userId` hoặc role do client gửi lên.
5. Request bảo vệ dữ liệu phải kiểm tra session từ database.
6. Authorization phải được kiểm tra gần nơi đọc hoặc sửa dữ liệu.
7. Không cache session giữa các request.
8. Chỉ đặt/xóa cookie trong Route Handler hoặc Server Action.
9. POST auth mới phải kiểm tra same-origin trước khi thay đổi state.

## Validation và error

Register yêu cầu email, password dài 12–128 ký tự, first name, last name và `institutionId` hợp lệ. Email được trim và chuyển lowercase; password không bị trim. Login không áp độ dài tối thiểu mới để account cũ vẫn đăng nhập được.

Mọi JSON error có cùng cấu trúc:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  }
}
```

UI nên dùng `error.code` cho logic, không so sánh `message`.

## Trang test tạm

Mở `/tools/auth-test` để test thủ công register, login, kiểm tra session, logout và logout-all. Trang hiển thị raw API response và trạng thái session hiện tại.

Form register lấy danh sách `Institution` trực tiếp từ database. Nếu chưa có Institution, thêm một dòng bằng `pnpm db:studio` trước khi test. Trang này dùng API và database thật, nên account tạo từ đây là dữ liệu thật.

## Kiểm tra

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Các phần chưa có: email verification, reset/change password, MFA, OAuth, rate limiting, quản lý danh sách thiết bị và job dọn session hết hạn.

import { z } from "zod"
import type { UserModel } from "@/app/generated/prisma/models"


// z.object, nếu input xuất hiện khoá lạ, thì âm thầm bỏ qua và tiếp tục
// z.strictObject: nếu có khoá lạ, lập tức lỗi
// vd: object: {name: z.string()}, mà nhận được 
// {name:"abc", isAdmin = true} -> z.object vứt isAdmin và âm thầm cho qua, 
// còn z.strictObject sẽ throw error

// phép satisfies của ts: kiểm tra xem cái này có khớp một kiểu nào đó không, nhưng không ép kiểu nó
// nếu như ta viết ":" cho type anotation, thì đối với 
// const a: Prisma.UserSelect = { id: true, email: true }; vì UserSelect chỉ quy định model có id và email
// việc dùng ":" sẽ khiến cho các lần sau dùng a, typescript sẽ không biết a.id là true và a.email là true nữa,
// giá trị thực tế của a bị gọt mất về còn đúng cái type/interface quy định
// còn satisties vẫn sẽ giữ 2 cái value của a, nó chỉ kiểm tra xem a có khớp với interface/type đinh nghĩa hay không

// ─── Vì sao mỗi schema dưới đây kết thúc bằng `satisfies z.ZodType<...>` ─────
//
// Prisma sinh ra type cho các bảng, nhưng KHÔNG sinh ra phép kiểm dữ liệu đầu vào. Nó không
// biết mật khẩu phải dài 12 ký tự, không biết email cần hạ chữ thường, và nhất là: form gửi lên
// `password` trong khi bảng lưu `passwordHash`. Nên phần Zod dưới đây phải viết tay.
//
// Viết tay thì sinh ra một rủi ro: tên trường ở đây và tên cột trong `prisma/schema/` là hai
// bản chép rời nhau. Đổi một bên, bên kia không hay biết. Zod vẫn kiểm một trường không còn tồn
// tại, mọi thứ vẫn biên dịch, và lỗi chỉ lộ ra khi dữ liệu đã chạy xuống database.
//
// Dòng `satisfies` là cầu chì nối hai bên lại:
//
//     prisma/schema/models/auth/User.prisma
//       ↓ prisma generate
//     UserModel
//       ↓ Pick<UserModel, "email" | ...>
//     LoginSchemaValue / SignUpSchemaValue
//       ↓ z.ZodType<...>
//       ↓ satisfies
//     LoginSchema / SignUpSchema
//
// Đổi tên cột trong Prisma thì `Pick` đứt trước tiên — nó chỉ nhận tên cột có thật — và kéo cả
// chuỗi đỏ theo. Bạn biết ngay lúc biên dịch, không phải lúc chạy.
//
// `z.ZodType<T>` là một interface, đọc là: MỌI schema Zod mà parse xong cho ra `T`. Nó chỉ soi
// kết quả parse, không quan tâm schema được dựng thế nào. Bỏ trống tham số `T` thì mặc định là
// `unknown` và mọi schema đều lọt — nên giá trị nằm cả ở cái type truyền vào.
//
// Lưu ý: nó KHÔNG sinh schema từ type. Không có chiều đó, vì schema mang luật lúc chạy (`min`,
// `trim`, `toLowerCase`) mà một type TypeScript không thể chứa. `z.ZodType` chỉ là cổng kiểm.
//
// Cuối cùng, vì sao `satisfies` chứ không phải `:` — xem ghi chú phía trên. Viết
// `const LoginSchema: z.ZodType<...> = ...` sẽ gọt kiểu thật xuống còn `ZodType` chung chung,
// mất `.shape` và mất luôn thông tin về từng trường ở mọi chỗ dùng sau này.



// SignUp Schema
export type SignUpSchemaValue = Pick<UserModel,
    | "email"
    | "firstName"
    | "lastName"
> & { password: string }

// Thứ tự trong chuỗi này QUAN TRỌNG: trim và toLowerCase phải chạy TRƯỚC phép kiểm email.
// Viết ngược lại thì email dính khoảng trắng do copy-paste sẽ bị báo là sai định dạng.
// `.pipe()` là cách nối: vế trái làm sạch, vế phải nhận kết quả đã sạch rồi mới kiểm. 
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email())

export const SignUpSchema = z.strictObject({
    email: emailSchema,
    password: z
        .string()
        .min(12, {message: "Password must be at least 12 character"})
        .max(128, {message: "Password must not exceed 128 characters"}),
    firstName: z.string().trim().min(1, {message: "First name must be at least 1 character"}).max(100),
    lastName: z.string().trim().min(1, {message: "Last name must be at least 1 character"}).max(100),
}) satisfies z.ZodType<SignUpSchemaValue>


// Login Schema
export type LoginSchemaValue = Pick<UserModel,
    | "email"
> & { password: string }

// KHÔNG đặt min(12) ở đây. Đó là luật cho lúc ĐẶT mật khẩu, không phải lúc KIỂM.
// Hôm nào nâng chính sách lên 14, người đã đăng ký với 12 ký tự sẽ bị chặn từ vòng ngoài
// dù mật khẩu của họ vẫn đúng. Ở đây chỉ hỏi "có nhập gì không"; đúng hay sai để verifyPassword trả lời.
export const LoginSchema = z.strictObject({
    email: emailSchema,
    password: z.string().min(1, {message: "Password is required"}).max(128),
}) satisfies z.ZodType<LoginSchemaValue> 



export type ValidationErrors = Record<string, string[]>;
/**
 * Gom lỗi Zod thành `{ tênTrường: [thông báo] }` để form gắn từng thông báo vào đúng ô.
 *
 * `parsed.error.message` là một chuỗi JSON dài, đưa thẳng ra giao diện thì người dùng không đọc
 * nổi và form cũng không biết ô nào sai.
 *
 * Lỗi không gắn với trường nào — ví dụ khoá lạ do `strictObject` chặn — rơi vào khoá `_form`.
 */
export function formatValidationErrors(error: z.ZodError): ValidationErrors {
    const fields: ValidationErrors = {};

    for (const issue of error.issues) {
        const field = typeof issue.path[0] === 'string' ? issue.path[0] : '_form';
        fields[field] ??= [];
        fields[field].push(issue.message);
    }

    return fields;
}

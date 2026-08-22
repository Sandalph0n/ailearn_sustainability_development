# AI-Learn — Kiến trúc

Tài liệu này mô tả **nền tảng** và **hợp đồng giữa nền tảng với công cụ**.

Nó cố ý KHÔNG mô tả bên trong từng công cụ. Công cụ dùng thư viện gì, dựng giao diện ra sao, ghi nhận thao tác bằng kỹ thuật nào — đều là việc riêng của công cụ đó. Xem §11.

Về phạm vi, lịch và phân công, xem [Project Plan.md](./Project%20Plan.md).

---

## 1. Nguyên tắc

Nền tảng cung cấp **lưu trữ, danh tính, quyền và ngữ cảnh**. Công cụ cung cấp **ý nghĩa**.

Hệ thống của ta không bao giờ hiểu nội dung sinh viên tạo ra. Nó không biết một chuỗi ký tự là mã nguồn hay một nhãn trên sơ đồ, không biết `node-move` nghĩa là gì. Nó biết: ai, lúc nào, thuộc bài nào, theo thứ tự ra sao.

Hệ quả trực tiếp: **thêm một công cụ mới không sửa gì ở nền tảng.**

### Công cụ là phần mềm độc lập

Công cụ không phải một nhánh `if` trong ứng dụng. Nó là phần mềm riêng, giao tiếp với nền tảng qua một API công bố sẵn — cùng mô hình mà các IDE dùng cho extension.

Về lâu dài điều này mở đường cho công cụ do bên thứ ba viết. Trước mắt, nó buộc ranh giới phải rõ ràng ngay từ đầu, thay vì phát hiện ra nó bị rò rỉ khi đã muộn.

---

## 2. `Tool` trong database TRỎ TỚI công cụ, không ĐỊNH NGHĨA công cụ

Bảng `Tool` chứa một `id` và một tên hiển thị. Nó không chứa — và không thể chứa — mã nguồn.

Nên **thêm một dòng vào bảng `Tool` không tạo ra công cụ nào cả.** Danh mục những gì thật sự tồn tại nằm ở phía mã nguồn. Dòng dữ liệu chỉ nói: cái tên đó được phép dùng cho bài tập này.

Điểm hẹn duy nhất giữa hai thế giới là **`Tool.id` dạng chuỗi** (`code`, `diagram`) do người phát triển đặt. Đó là lý do nó không phải UUID: cả mã nguồn lẫn dữ liệu đều phải viết được cái tên này ra, bằng tay.

Cái giá phải chấp nhận: **`Tool.id` không được đổi sau khi đã dùng**, vì nó nằm rải trong mọi bản ghi sự kiện đã lưu.

### Hai bên lệch nhau

Không có trình biên dịch nào bắt được:

| Tình huống | Hậu quả |
|---|---|
| Có dòng trong DB, không có mã | Vỡ lúc chạy khi ai đó mở bài |
| Có mã, không có dòng trong DB | Công cụ tàng hình |

Cần một phép kiểm lúc khởi động: đối chiếu danh sách công cụ đã đăng ký trong mã với bảng `Tool`, báo lệch ngay thay vì chờ tới lúc có người mở bài.

---

## 3. Mọi dữ liệu đều là nội dung

Mã nguồn là text. Sơ đồ tuần tự hoá ra text. Văn bản định dạng phân tích được về text.

Nền tảng vì vậy chỉ cần một khái niệm lưu trữ duy nhất: **tài liệu có đường dẫn và nội dung.** Công cụ muốn diễn giải nội dung đó thành mã, thành sơ đồ hay thành gì khác là việc của nó.

**Đặt tên khái niệm là "nội dung", không phải "text".** Ngày nào đó có sơ đồ nhúng ảnh hoặc bài nộp kèm tệp nhị phân, API không phải thiết kế lại. Rẻ bây giờ, đắt sau.

---

## 4. Op-log — xương sống

Đây là abstraction DUY NHẤT được đầu tư sâu. Mọi thành phần khác làm ở mức thô nhất chạy được.

### Vì sao không phải ảnh chụp định kỳ

Nếu nền tảng chỉ lưu "nội dung tại từng thời điểm", ta có một chuỗi ảnh chụp. Ảnh chụp không cho biết đoạn mã kia xuất hiện dần trong mười phút hay hiện ra nguyên khối trong một giây — mà đó chính là câu hỏi cả hệ thống sinh ra để trả lời.

Nên sự kiện phải là **thao tác có cấu trúc**, không phải trạng thái.

### Định dạng sự kiện

Đây là hợp đồng giữa hai người trong nhóm. Chốt sớm, sau đó không đổi.

```ts
type ToolId = string          // 'code' | 'diagram' | …

interface SessionEvent {
  seq: number                 // thứ tự trong phiên, tăng đơn điệu, do client cấp
  at: number                  // epoch ms — đồng hồ MÁY NGƯỜI DÙNG
  tool: ToolId
  docId: string               // tài liệu nào trong phiên
  type: string                // do công cụ định nghĩa
  payload: unknown            // do công cụ định nghĩa
}
```

Bốn trường đầu là phần **nền tảng hiểu**. `type` và `payload` là phần **nền tảng lưu mù**.

### Máy chủ là đồng hồ độc lập

Khi nhận, máy chủ gắn thêm `receivedAt` bằng đồng hồ của chính nó. Cặp `at` / `receivedAt` nằm cạnh nhau là có chủ ý: lệch lớn giữa chúng là dấu hiệu đồng hồ máy người dùng đã bị chỉnh.

Đây là thứ có được miễn phí chỉ vì sự kiện đi qua máy chủ.

### Lưu theo lô

Một buổi làm bài cỡ thật sinh hàng nghìn sự kiện. Mỗi sự kiện một dòng là hàng nghìn lần ghi database cho một buổi. Vì phát lại luôn đọc tuần tự từ đầu, gom lô không mất gì.

`EventBatch` giữ `seqStart`/`seqEnd`. Cặp số này cho phép phát hiện lô thất lạc: `seqStart` của lô sau không nối tiếp `seqEnd` của lô trước nghĩa là có gì đó đã mất trên đường.

### Gộp sự kiện — trách nhiệm của công cụ

Ghi mỗi phím một sự kiện là lãng phí. Gộp bao nhiêu, theo tiêu chí nào, là quyết định của từng công cụ vì chỉ nó biết thao tác nào đáng giữ.

Nguyên tắc chung: **giữ thứ suy ra không được, bỏ thứ suy ra được.** Ví dụ với trình soạn thảo, vị trí con trỏ sau một phép sửa suy ra được từ chính phép sửa đó, nhưng vùng người dùng bôi đen thì không suy ra được từ đâu cả.

---

## 5. Hợp đồng công cụ

Hai chiều, và chiều thứ nhất KHÔNG phải lời gọi hàm — nó là thứ công cụ xuất ra.

### Chiều 1 — nền tảng gọi vào công cụ

```ts
export default {
  id: 'diagram',
  mount(container: HTMLElement, ctx: ToolContext): void,
  dispose(): void,
}
```

`mount` nhận một thẻ DOM và **quyền sở hữu hoàn toàn** thẻ đó. Từ giao điểm này trở đi, nền tảng không đụng vào bên trong nữa.

### Chiều 2 — công cụ gọi vào nền tảng

```ts
import ailearn from 'ailearn'

ailearn.files.read(path)
ailearn.files.write(path, content, { hash })
ailearn.files.list()

ailearn.events.emit(event)              // gửi sự kiện, nền tảng gom lô
ailearn.events.read(workSessionId)      // đọc lại — máy chủ kiểm quyền

ailearn.context                         // xem ToolContext bên dưới
```

### Ngữ cảnh

```ts
interface ToolContext {
  userId: string
  role: 'OWNER' | 'MARKER'    // chủ bài, hay người chấm
  workSessionId: string
  attemptId: string | null    // null = phiên tự do
  readOnly: boolean           // đã nộp, hoặc đang xem bài người khác
}
```

`role` ở đây là **vai trò đối với bài đang mở**, không phải chức danh trong hệ thống. Nền tảng suy ra nó từ `Membership` trước khi trao cho công cụ.

### Trong 4 tuần đầu: giữ hợp đồng, đừng đóng gói

Hai công cụ nằm cùng repo, nhưng **chỉ được đi qua đúng interface trên** — không gọi tắt vào database, không import chéo. Giữ được kỷ luật đó thì việc tách ra thành gói riêng về sau chỉ là chuyển file.

---

## 6. Phát lại thuộc về công cụ

Nền tảng không biết `node-move` nghĩa là gì, nên nó không thể dựng lại trạng thái. Chỉ công cụ làm được.

Do đó **không có màn hình chấm bài riêng ở nền tảng.** Cùng một công cụ, mở bởi vai trò khác nhau thì hiện khác nhau:

| Ai mở | Công cụ hiện gì |
|---|---|
| Chủ bài, đang làm | Giao diện soạn thảo bình thường |
| Chủ bài, đã nộp | Như trên, chỉ đọc |
| Người chấm | Thêm phần tua lại theo dòng thời gian |

Công cụ đọc `ctx.role` rồi tự quyết.

### Kiểm chứng bằng mốc hash

Mỗi lần lưu tài liệu, công cụ gửi kèm hash nội dung tại thời điểm đó. Nền tảng chỉ lưu, không hiểu.

Lúc phát lại, công cụ so hash của trạng thái nó dựng lại được với hash đã ghi. Lệch nghĩa là chuỗi sự kiện thủng — đã bỏ sót thao tác nào đó.

Không có phép kiểm này thì một dòng thời gian thiếu dữ liệu trông y hệt một dòng thời gian đầy đủ.

---

## 7. Quyền đọc thuộc về máy chủ

**Công cụ ẩn nút đi là chuyện giao diện, không phải bảo mật.**

Mã của công cụ chạy trên máy người dùng. Ai cũng sửa được, hoặc bỏ qua nó mà gọi thẳng API.

| Câu hỏi | Ai trả lời |
|---|---|
| Có hiện phần tua lại không | Công cụ, dựa trên `ctx.role` |
| Có được đọc sự kiện của bài đó không | **Máy chủ**, kiểm `Membership.role` |

Mỗi lần đọc lại, máy chủ phải tự trả lời: người gọi có phải `TUTOR` hoặc `CONVENOR` của đúng `Offering` chứa bài này không. Schema đã đủ dữ liệu để trả lời bằng một truy vấn.

---

## 8. Cờ bất thường

Cờ là **chỉ dấu để xem kỹ đoạn đó**, không phải kết luận. Giao diện phải trình bày chúng đúng như vậy.

Chia đôi trách nhiệm theo việc có cần hiểu nội dung hay không:

**Nền tảng tự tính** — chỉ cần thời gian và thứ tự, đúng cho mọi công cụ:

| Cờ | Điều kiện |
|---|---|
| `idle-then-bulk` | im lặng dài rồi có khối hoạt động lớn |
| `clock-skew` | `at` lệch `receivedAt` quá ngưỡng |
| `seq-gap` | số thứ tự đứt quãng giữa các lô |

**Công cụ khai báo** — cần hiểu nội dung: thế nào là dán từ nguồn ngoài, bao nhiêu ký tự thì gọi là chèn khối lớn.

Lợi ích của cách chia này: một công cụ chưa khai cờ nào vẫn có sẵn một lớp phát hiện cơ bản.

---

## 9. Kiểm tính liên tục tại mốc tự nhiên

Máy chủ giữ hash của lô sự kiện cuối cùng nó đã nhận cho mỗi buổi làm việc. Chuỗi sinh viên nộp lên phải nối tiếp đúng những gì máy chủ đã thấy.

**Không chạy theo nhịp thời gian.** Kiểm tại hai mốc có sẵn trong luồng:

1. **Sinh viên mở lại bài để làm tiếp** — máy chủ so lô cuối nó biết với thứ client báo
2. **Giảng viên mở bài ra chấm** — kiểm toàn chuỗi trước khi hiển thị

Được ba thứ: không có tiến trình nền phải nuôi, không có lịch chạy phải xử lý lỗi, và phép kiểm chạy đúng lúc kết quả của nó có người cần tới.

---

## 10. Tầng giao diện

Trang điều hướng, danh sách, biểu mẫu, lịch: **React thông thường**.

Vùng của công cụ: **island imperative** — React giữ một `<div>` bằng `useRef` rồi giao hẳn quyền cho JS thuần. Đây không phải tối ưu hoá mà là bắt buộc: công cụ sở hữu thẻ DOM đó, React can thiệp vào bên trong là hỏng.

Ba quy tắc giữ ranh giới không rò rỉ:

1. **Container bất động** — thẻ `<div>` không nhận `key` đổi, không nằm dưới điều kiện render, không nhận prop ảnh hưởng tới nó. React dựng một lần rồi không đụng nữa.
2. **Ranh giới là một handle rõ ràng** — React gọi vào công cụ qua phương thức trên handle; công cụ báo ngược ra bằng callback. Không có đường thứ ba.
3. **Ghi nhận móc vào tầng imperative, không móc vào React** — sự kiện lấy thẳng từ tầng thao tác của công cụ, không phải từ `useEffect` quan sát state. Nhờ vậy việc ghi nhận độc lập hoàn toàn với vòng đời render: re-render bao nhiêu lần cũng không sinh thêm hay làm mất sự kiện nào.

---

## 11. Bên trong công cụ — ngoài phạm vi tài liệu này

Mỗi công cụ tự chọn thư viện, cách dựng giao diện, cách bắt thao tác của người dùng. Nền tảng không biết và không cần biết.

Điều kiện duy nhất: thoả hợp đồng ở §5, và phát ra `SessionEvent` đúng định dạng ở §4.

| Công cụ | `Tool.id` | Người làm |
|---|---|---|
| Soạn mã | `code` | (người A) |
| Vẽ sơ đồ | `diagram` | (người B) |

Ghi chú kỹ thuật riêng của từng công cụ để ở file khác, không đưa vào đây.

---

## 12. Hạ tầng

Một ứng dụng **Next.js** duy nhất, cả giao diện lẫn máy chủ. Dữ liệu: **PostgreSQL + Prisma**, một kho duy nhất.

Demo chạy cục bộ (Docker Postgres + Next.js localhost). Không triển khai. Nhưng bốn quy tắc sau tuân từ đầu thì chuyển sang AWS chỉ là đổi chuỗi kết nối:

1. Không dùng đĩa cục bộ làm nguồn sự thật — tài liệu nằm trong database
2. Không giữ trạng thái trong RAM giữa các request — phiên tra từ database
3. Mọi cấu hình qua biến môi trường
4. Không phụ thuộc tiến trình sống lâu hay kết nối thường trực

Quy tắc 4 có một hệ quả cần biết: **không xem trực tiếp được.** Giảng viên tua lại sau khi sinh viên nộp, không theo dõi lúc đang làm. Nếu sau này cần, phải thêm hạ tầng khác.

---

## 13. Còn để ngỏ

**Ranh giới tin cậy với công cụ bên thứ ba.** Công cụ là bên tạo ra nhật ký liêm chính. Một công cụ bị sửa có thể tạo nhật ký giả. Với công cụ do chính nhóm viết thì không thành vấn đề; với công cụ cộng đồng thì đó là toàn bộ bài toán. Hướng khả dĩ: phân biệt công cụ đã kiểm định và công cụ cộng đồng, chỉ công cụ đã kiểm định mới dùng được cho bài có chấm điểm.

**Nạp công cụ không nằm trong bản build.** Quyết định chỗ nối ở §2 là bảng tra tĩnh hay trình nạp động. Hợp đồng ở §5 không đổi theo lựa chọn này — đó là lý do có thể hoãn.

**Mô hình dữ liệu vừa làm vừa sửa.** Các trường đã hoãn: mốc thời gian của kỳ học, trọng số bài tập, quy tắc lặp và múi giờ cho lịch, thu hồi phiên đăng nhập.

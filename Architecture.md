# Lernumi — Kiến trúc

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

## 2. `Tool` và `ToolVersion`

`Tool` là danh tính bền vững của một phần mềm: UUID nội bộ, `code` bất biến dùng trong URL, tên và mô tả. Mã thực thi không nằm trực tiếp trên dòng này.

Mỗi lần upload ZIP tạo một `ToolVersion` mới và một prefix mới trong bucket `tools`. Version chứa manifest đã kiểm, hash SHA-256, đường dẫn entry duy nhất và metadata của package. Nội dung version không có API sửa hay ghi đè.

`Tool.activeVersionId` chỉ là con trỏ mặc định cho phiên mới. `AssignmentWorkSession.toolVersionId` pin version chạy thật; đổi active version không làm một phiên cũ đổi code, nên replay luôn dùng đúng phần mềm đã sinh ra chuỗi event đó. Hợp đồng đầy đủ nằm tại [`docs/tool-platform`](./docs/tool-platform/README.md).

Package phải có cấu trúc tối thiểu:

```text
/tool.json
/index.html
/assets/…
```

Manifest hiện tại:

```json
{
  "schemaVersion": 1,
  "code": "code-editor",
  "version": "1.0.0",
  "entry": "index.html"
}
```

Chỉ có **một entry**. Replay không phải application hoặc entry thứ hai.

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

`EventBatch` giữ `seqStart`/`seqEnd`. Cặp số này cho phép phát hiện lô thất lạc: `seqStart` của lô sau không nối tiếp `seqEnd` của lô trước nghĩa là có gì đó đã mất trên đường. `clientBatchId` do tool sinh làm idempotency key, nên gửi lại đúng một lô sau khi mất kết nối không tạo dữ liệu trùng.

### Gộp sự kiện — trách nhiệm của công cụ

Ghi mỗi phím một sự kiện là lãng phí. Gộp bao nhiêu, theo tiêu chí nào, là quyết định của từng công cụ vì chỉ nó biết thao tác nào đáng giữ.

Nguyên tắc chung: **giữ thứ suy ra không được, bỏ thứ suy ra được.** Ví dụ với trình soạn thảo, vị trí con trỏ sau một phép sửa suy ra được từ chính phép sửa đó, nhưng vùng người dùng bôi đen thì không suy ra được từ đâu cả.

---

## 5. Hợp đồng công cụ

Tool là một web application độc lập được chạy từ subpath của nền tảng. Nó không import mã nguồn nội bộ và không gọi database; toàn bộ giao tiếp đi qua HTTP API công khai của nền tảng.

Khi mở một work session, nền tảng phát JWT sống ngắn. JWT pin `toolId`, `toolVersionId`, `workSessionId`, workspace, chế độ và các capability cụ thể:

```ts
type ToolCapability =
  | 'files:read'
  | 'files:write'
  | 'events:append'
  | 'replay:read'
```

Tool dùng bearer token cho API đọc/ghi file và gửi/đọc event batch. API kiểm chữ ký, audience, expiry và capability trên từng request. JWT tránh truy vấn login session và RBAC cho từng autosave/event batch; lúc refresh token, máy chủ kiểm lại quyền đầy đủ. TTL hiện tại là năm phút để giới hạn độ trễ khi quyền bị thu hồi.

Ẩn một tab theo capability chỉ là UX. API vẫn từ chối nếu token thiếu capability tương ứng.

---

## 6. Phát lại thuộc về công cụ

Nền tảng không biết `node-move` nghĩa là gì, nên nó không thể dựng lại trạng thái. Chỉ công cụ làm được.

Do đó **không có màn hình replay riêng ở nền tảng.** Cùng một entry của công cụ, mở với capability khác nhau thì hiện khác nhau:

| Ai mở | Công cụ hiện gì |
|---|---|
| Chủ bài, đang làm | Giao diện soạn thảo bình thường |
| Chủ bài, đã nộp | Như trên, chỉ đọc |
| Người có `replay:read` | Thêm tab tua lại theo dòng thời gian |

Công cụ đọc claims/capability rồi tự quyết. Không có `replayEntry`: code editor và replay của code editor là hai tab trong cùng một tool version.

### Kiểm chứng bằng mốc hash

Mỗi lần lưu tài liệu, công cụ gửi kèm hash nội dung tại thời điểm đó. Nền tảng chỉ lưu, không hiểu.

Lúc phát lại, công cụ so hash của trạng thái nó dựng lại được với hash đã ghi. Lệch nghĩa là chuỗi sự kiện thủng — đã bỏ sót thao tác nào đó.

Không có phép kiểm này thì một dòng thời gian thiếu dữ liệu trông y hệt một dòng thời gian đầy đủ.

---

## 7. Phân quyền

### 7.1 Mọi phép kiểm chạy ở máy chủ

**Giao diện ẩn nút đi là chuyện trình bày, không phải bảo mật.**

Mã của công cụ chạy trên máy người dùng. Ai cũng sửa được, hoặc bỏ qua nó mà gọi thẳng API.

| Câu hỏi | Ai trả lời |
|---|---|
| Có hiện phần tua lại không | Công cụ, dựa trên `ctx.role` |
| Có được đọc sự kiện của bài đó không | **Máy chủ** |

### 7.2 Mô hình: RBAC có phạm vi

Câu "Alice là Trợ giảng" tự nó vô nghĩa — trợ giảng của **cái gì**? Cùng lúc, Alice có thể là trợ giảng một lớp, sinh viên lớp khác, và quản trị của cả trường.

Nên phép gán không phải cặp mà là **bộ ba**:

```
(người, vai trò, PHẠM VI)
```

Phạm vi có ba loại: **toàn hệ thống**, **cơ sở giáo dục**, **lượt mở môn**.

### 7.3 Ranh giới: cái gì thuộc mã, cái gì thuộc dữ liệu

| | Ai sở hữu | Vì sao |
|---|---|---|
| Danh sách quyền | **Mã** | Một quyền chỉ có nghĩa khi có đoạn mã thật sự kiểm nó. Cho người dùng tự tạo quyền thì sinh ra quyền mà không ai hỏi tới — tức quyền giả |
| Mỗi quyền thuộc **loại** phạm vi nào | **Mã** | `attempt.mark` bản chất thao tác trên thứ thuộc một lượt mở môn. Cấu hình lại được thì vô nghĩa |
| Vai trò gồm những quyền gì | **Dữ liệu** | Mỗi cơ sở tự nghĩ ra vai trò của mình |
| Ai giữ vai trò nào ở **thực thể** phạm vi nào | **Dữ liệu** | |

Cùng nguyên tắc với `Tool.id` ở §2: **mã giữ từ vựng, dữ liệu chỉ trỏ tới.**

Hệ quả cần ép bằng kiểu: khai danh sách quyền thành hằng số có kiểu, sinh dữ liệu gieo *từ* hằng số đó, và cho hàm kiểm chỉ nhận đúng những giá trị ấy. Gõ sai thành lỗi biên dịch, không phải lỗi lúc chạy.

Gắn luôn loại phạm vi vào kiểu thì truyền nhầm một cơ sở vào chỗ cần một lượt mở môn cũng bị bắt lúc biên dịch.

### 7.4 Quyền KHÔNG BAO GIỜ gán thẳng cho người

Chỉ gán cho vai trò. Đó là toàn bộ lý do RBAC tồn tại: sửa một vai trò là sửa cho mọi người mang nó, ở một chỗ.

Hễ mở ngoại lệ kiểu "cho riêng người này thêm một quyền", vài tháng sau sẽ không ai trả lời được *"ai đang có quyền gì"*.

### 7.5 Vai trò bao gồm vai trò

Một vai trò kế thừa toàn bộ quyền của vai trò khác — "Phụ trách môn" bao gồm "Trợ giảng". Không phải chép danh sách quyền, và sửa một chỗ là mọi vai trò kế thừa đổi theo.

**Bảng khai báo quan hệ bao gồm là nguồn sự thật. Tập quyền đầy đủ là thứ ĐƯỢC TÍNH RA từ nó** — lưu riêng, và không ai được sửa tay vào.

Ba điều bắt buộc:

- **Chặn chu trình lúc GHI**, không phải lúc đọc. A bao gồm B, B bao gồm A là đệ quy vô tận. Bắt lúc ghi thì báo lỗi cho đúng người vừa gây ra nó.
- **Trải phẳng lúc ghi, không đệ quy lúc đọc.** Phép kiểm quyền chạy liên tục; định nghĩa vai trò gần như không đổi. Đặt việc nặng vào phía hiếm khi xảy ra.
- **Tính lại TOÀN BỘ, đừng tính gia tăng.** Dữ liệu vai trò rất nhỏ (vài chục dòng). Cập nhật thông minh kiểu "sửa cái này thì tính lại đúng những cái bị ảnh hưởng" là loại mã sai âm thầm — quên một đường ghi là quyền lệch mà không có gì báo. Dựng lại cả bảng tốn vài mili giây và xoá hẳn một lớp lỗi.

Giữ cây kế thừa **nông**, hai ba tầng. Sâu hơn thì không ai trả lời nổi *"vì sao người này có quyền đó"* — mà đó đúng là câu hỏi cần trả lời lúc có sự cố.

### 7.6 Phạm vi vai trò quyết định tập tài nguyên

Vai trò `INSTITUTION` áp dụng quyền của nó lên toàn bộ cơ sở. Nếu quyền đó thao tác tài nguyên cấp offering (assessment, attempt, tool session...), nó bao phủ mọi offering hiện tại và tương lai của cơ sở ấy.

Vai trò `OFFERING` chỉ áp dụng lên các offering được nối bằng `ScopeAssignment`. Một assignment có thể nối tới nhiều offering; không cần cấp lại cùng role nhiều lần. Assignment chưa có scope vẫn tồn tại hợp lệ nhưng chưa tác động lên offering nào.

Tài nguyên thuần cấp cơ sở như tên trường, term hoặc việc tạo subject không thể được sửa bằng vai trò `OFFERING`, vì không có một offering riêng lẻ nào là phạm vi có nghĩa cho hành động đó.

Bao gồm vai trò và phạm vi vẫn là hai trục độc lập:

- *bao gồm vai trò* trả lời **có quyền nào**;
- `Role.scopeType` cùng `ScopeAssignment` trả lời **quyền ấy tác động lên tài nguyên nào**.

### 7.7 Một cửa duy nhất

Mọi phép kiểm đi qua đúng một hàm:

```ts
can(user, 'attempt.mark', offering)
```

**Không rải `if (role === 'TUTOR')` ở bất kỳ đâu.** Lý do không phải cho gọn: khi nào cần cho cơ sở tự định nghĩa vai trò, chỉ thay phần ruột của hàm này — không một chỗ gọi nào phải sửa. Còn nếu điều kiện rải khắp nơi thì đó là viết lại cả ứng dụng.

### 7.8 Vì sao không dùng ABAC hay ReBAC

Cả hai đều tránh được việc nhân bản bộ máy phân quyền cho từng loại tài nguyên, và ReBAC hợp với hình dạng dữ liệu ở đây hơn — mọi câu hỏi phân quyền trong hệ này đều là đi theo một đường quan hệ.

Nhưng có một yêu cầu loại chúng ra: **phải trả lời được câu hỏi ngược.**

> *"liệt kê mọi bài làm mà tôi được chấm"*

Đó là một **truy vấn**, không phải một phép kiểm. RBAC có phạm vi trả lời bằng một câu JOIN. ABAC thuần phải duyệt qua mọi bài làm rồi chạy luật lên từng cái. ReBAC làm được nhưng cần một dịch vụ riêng chạy song song.

RBAC có phạm vi thật ra đã là một dạng ABAC nhẹ — phạm vi chính là *một* thuộc tính, thuộc tính duy nhất thật sự quan trọng ở đây.

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
| Soạn mã | `code` | Nguyên |
| Vẽ sơ đồ | `diagram` | Duy |

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

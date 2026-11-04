# Lernumi — Kế hoạch dự án

Bắt đầu 21/08/2026 · Hạn 21/09/2026 · 2 người · Sản phẩm demo · The 17 Goals, Goal 4

Tài liệu này giữ **phạm vi, lịch và phân công**. Quyết định kỹ thuật và lý do nằm ở [architecture.md](./architecture.md). Ghi chú triển khai riêng từng công cụ ở thư mục [`notes/`](./notes/).

---

## 1. Mục tiêu

Nền tảng học tập web, đa cơ sở giáo dục, cung cấp các công cụ làm bài cho sinh viên. Mọi công cụ đều ghi lại toàn bộ quá trình làm bài dưới dạng chuỗi thao tác **tua lại được**, để giảng viên xem lại khi chấm.

Hai công cụ trong phạm vi demo: **coding** và **diagram**. Kèm một **hệ thống lịch/planner** thống nhất cho assessment, lớp học và sự kiện cá nhân.

### Ràng buộc

| | |
|---|---|
| Thời gian | 4 tuần |
| Nhân lực | 2 người, ngang hàng |
| Hạ tầng demo | Chạy local — Docker Postgres + Next.js localhost |
| Hạ tầng đích | AWS (chỉ giữ tính tương thích, không deploy trong phạm vi này) |
| Vòng đời | Sản phẩm demo, không cần bảo trì sau khi trình bày |

---

## 2. Phạm vi

### Luồng chính phải chạy được

1. Sinh viên đăng ký / đăng nhập, chọn cơ sở giáo dục
2. Xem lịch: deadline assessment, lớp học, sự kiện tự thêm
3. Mở một assessment → chọn công cụ được phép → làm bài
4. Toàn bộ thao tác được ghi nhận trong lúc làm
5. Giảng viên mở bài làm đó, tua lại từ đầu, xem các mốc bất thường được đánh dấu
6. Giảng viên ghi note và chấm điểm

### Ngoài phạm vi

- Công cụ docs/LaTeX (ưu tiên cuối, gần như chắc chắn không kịp)
- Trình nạp extension từ cộng đồng — danh sách công cụ khai cứng trong mã là đủ
- Cộng tác thời gian thực, giảng viên xem trực tiếp
- Mã hoá log, chuỗi hash chống giả mạo cục bộ — không cần vì log nằm ở server
- Deploy AWS, mobile, đa ngôn ngữ, tích hợp LMS

---

## 3. Kiến trúc

### Tổng thể

Một ứng dụng **Next.js** duy nhất, gồm cả front-end lẫn back-end. Không tách hai dịch vụ độc lập: với quy mô và thời gian này, tách đôi chỉ thêm hai lần deploy, hai lần cấu hình CORS, hai lần auth, và mất kiểu dữ liệu dùng chung.

Dữ liệu: **PostgreSQL + Prisma**, một kho duy nhất.

Mô hình quan hệ dày (institution → subject → offering → assessment → attempt → marking, cộng membership nối người dùng với môn theo vai trò) nên SQL là lựa chọn đúng. Phần event log tuy có hình dạng phi quan hệ nhưng `JSONB` gánh được ở quy mô này; dựng thêm một kho NoSQL riêng chỉ để chứa nó sẽ mua thêm một đường vận hành và làm mất transaction chung.

### Op-log — xương sống dùng chung

Mỗi công cụ ghi nhận hoạt động theo **cùng một định dạng sự kiện**. Lưu trữ, replay, timeline và màn hình chấm bài viết một lần, dùng cho mọi công cụ. Thêm công cụ mới chỉ là viết một adapter.

Đây là abstraction duy nhất được đầu tư sâu trong dự án. Mọi thành phần khác làm ở mức thô nhất chạy được.

### Quy tắc tương thích AWS

Demo chạy local, nhưng bốn quy tắc sau tuân từ đầu thì chi phí gần bằng không, sửa sau thì đắt:

1. Không dùng đĩa cục bộ làm nguồn sự thật — file sinh viên nằm trong DB, không ở `./uploads`
2. Không giữ state trong RAM giữa các request — session tra từ DB, không phải `Map` trong process
3. Mọi cấu hình qua biến môi trường, không hardcode chuỗi kết nối
4. Không phụ thuộc tiến trình sống lâu hay WebSocket

Khi cần đẩy lên AWS, việc còn lại chỉ là đổi `DATABASE_URL` và chọn nơi chạy.

---

## 4. Đặc tả op-log

Đây là **hợp đồng giữa hai người** — điểm chạm duy nhất. Chốt trong 2 ngày đầu, sau đó không đổi.

### Định dạng sự kiện

```ts
type ToolId = 'code' | 'diagram'

interface SessionEvent {
  seq: number       // thứ tự trong phiên, tăng đơn điệu, do client cấp
  at: number        // epoch ms — đồng hồ client
  tool: ToolId
  docId: string     // tài liệu nào trong phiên
  type: string      // do từng công cụ định nghĩa
  payload: unknown  // do từng công cụ định nghĩa
}
```

Server gắn thêm `receivedAt` khi nhận — đồng hồ độc lập với máy client.

### Nghĩa vụ của mỗi công cụ

| Hàm | Vai trò |
|---|---|
| `record()` | Móc vào tầng imperative của công cụ, phát ra `SessionEvent` |
| `apply(state, event) → state` | Hàm thuần, quyết định luận |
| `snapshot()` | Trạng thái đầy đủ theo chu kỳ, kèm hash nội dung |

**Yêu cầu bắt buộc:** `replay(events[0..n])` phải cho ra đúng trạng thái tài liệu tại sự kiện `n`.

Snapshot phục vụ hai việc: tua nhanh tới giữa phiên, và làm **mốc kiểm chứng** — replay tới mốc mà hash lệch nghĩa là recorder đã bỏ sót sự kiện. Không có mốc này thì một timeline thủng vẫn trông bình thường.

### Sự kiện công cụ coding

Nguồn: `onDidChangeModelContent` của Monaco, trả về sẵn phép sửa tối thiểu — không tự diff, không chụp ảnh định kỳ.

| type | payload | nhịp |
|---|---|---|
| `edit` | `{ rangeOffset, rangeLength, text }` | gộp phím liên tiếp trong 2s |
| `selection` | `{ anchor, active }` | gộp 250ms; bỏ chọn ghi ngay |
| `paste` | `{ length, origin: 'internal' \| 'external' }` | tức thì |
| `save` | `{ hash }` | tức thì — đây là mốc kiểm chứng |
| `doc-open` / `doc-close` | `{ path }` | tức thì |

Chỉ ghi vùng bôi đen, **không ghi vị trí con trỏ**: vị trí con trỏ suy ra được từ chính phép sửa, ghi lại chỉ làm log phình thêm khoảng 38% mà không thêm thông tin. Vùng bôi đen thì không suy ra được từ đâu, và nó cho biết sinh viên đang thao tác lên đoạn nào.

Nhịp gộp khác nhau là cố ý: kéo chuột bắn ra hàng chục sự kiện trung gian, chỉ vị trí dừng mới đáng giữ; nhưng thiếu bản ghi bỏ chọn thì lúc phát lại vệt tô sáng đứng nguyên mãi.

### Sự kiện công cụ diagram

Nguồn: `onNodesChange` / `onEdgesChange` của React Flow — đưa sẵn từng thay đổi rời rạc.

| type | payload |
|---|---|
| `node-add` / `node-remove` | `{ nodeId, kind, position }` |
| `node-move` | `{ nodeId, from, to }` — gộp 250ms, giữ vị trí thả |
| `node-label` | `{ nodeId, text }` |
| `edge-add` / `edge-remove` | `{ edgeId, source, target }` |

### Cờ bất thường

Tính ở server lúc nhận lô sự kiện, lưu thành bản ghi riêng.

| Cờ | Điều kiện |
|---|---|
| `external-paste` | `paste` với `origin: 'external'`, `length > 200` |
| `large-insert` | một `edit` chèn > 300 ký tự, không có chuỗi gõ đứng trước |
| `idle-then-bulk` | im lặng > 10 phút rồi xuất hiện khối lớn |
| `clock-skew` | `at` lệch `receivedAt` quá vài phút |

Cờ là chỉ dấu để giảng viên xem kỹ đoạn đó, không phải kết luận. Màn hình chấm bài hiển thị chúng như mốc trên timeline.

---

## 5. Mô hình dữ liệu

```
Institution     id, name, code, country, timezone
Term            institutionId, name, year, sessionNo, startDate, endDate
Subject         institutionId, code, name
Offering        subjectId, termId
User            id, email, passwordHash, firstName, lastName, homeInstitutionId
Session         userId, tokenHash, expiresAt, revokedAt
Membership      userId, offeringId, role: STUDENT | TUTOR | CONVENOR
Tool            id, code, name, activeVersionId
ToolVersion     toolId, version, entryPath, manifest, storagePrefix, sha256
Assessment      offeringId, title, weighting, dueAt, isHurdle, allowedToolIds[]
Attempt         assessmentId, userId, startedAt, submittedAt?
WorkSession     assignmentWorkspaceId, toolId, toolVersionId, startAt, endAt?
Document        workspaceId, parentFolderId?, name, entryKind, contentHash, metadata
EventBatch      workSessionId, clientBatchId, seqStart, seqEnd, events JSONB, clientAt, receivedAt
Flag            sessionId, seq, kind, severity, detail JSONB
Marking         attemptId, markerId, score, rubric JSONB, notes, createdAt
CalendarEvent   userId, title, startAt, endAt, allDay, rrule, timezone,
                source: MANUAL | ASSESSMENT | CLASS | IMPORTED, sourceRef
```

### Các quyết định cần ghi rõ

**`Offering` tách khỏi `Subject`.** `Subject` một mình không phân biệt được cùng một môn mở ở hai kỳ khác nhau. Assessment, thành viên lớp và deadline đều gắn vào *lượt mở môn*, không gắn vào môn.

**Không có bảng `Staff`.** Vai trò thuộc về quan hệ giữa người và môn, không thuộc về con người: cùng một người có thể là sinh viên môn này và trợ giảng môn khác. Do đó vai trò nằm ở `Membership`.

**`WorkSession.attemptId` cho phép NULL.** Đây là chỗ dành cho *phiên tự do* — sinh viên mở công cụ ra dùng mà không gắn với bài tập nào. Chỉ khi vào từ một assessment thì phiên mới thuộc về một `Attempt` và được chấm.

**Sự kiện lưu theo lô.** Một bài tập cỡ thật sinh khoảng 7.500 sự kiện; mỗi sự kiện một dòng là lãng phí, mà replay vốn đọc tuần tự nên gom lô không mất gì. `Flag` thì ngược lại — số lượng ít và cần truy vấn, nên tách thành bản ghi riêng.

**`Marking` nhiều dòng cho một `Attempt`.** Một bài có thể được chấm nhiều lần, hoặc chấm lại sau khiếu nại. Ghi đè một dòng là mất lịch sử chấm.

**Không lặp `institutionId` xuống các bảng con.** Nguồn sự thật chảy theo `Institution → Subject → Offering → Assessment → Attempt`. Nếu sau này cần cột sao chép cho nhanh thì thêm, nhưng phải hiểu đó là bản sao — hai nguồn sự thật sẽ có ngày lệch nhau.

### Lịch: thiết kế để export

Yêu cầu export sang Google Calendar / Apple Calendar quy về một việc: lưu dữ liệu theo hình dạng của **RFC 5545** ngay từ đầu, thì export chỉ còn là phép biến đổi máy móc.

- `rrule` lưu **chuỗi RRULE chuẩn** (`FREQ=WEEKLY;BYDAY=TU;UNTIL=...`), không phải cấu trúc tự chế
- `startAt` / `endAt` lưu UTC, kèm `timezone` dạng IANA — lịch lớp hàng tuần vắt qua mốc đổi giờ sẽ sai nếu chỉ có UTC
- `source` phân biệt sự kiện người dùng tự thêm với sự kiện sinh từ assessment, để lần đồng bộ sau không đè mất thứ họ tự nhập

Gantt cho assessment không cần bảng riêng — đó là cách hiển thị khoảng `startAt → dueAt`.

### Adapter theo cơ sở giáo dục

```ts
interface InstitutionAdapter {
  id: string
  findSubject(code: string, year: number, session: number): Promise<SubjectData>
  listTerms(year: number): Promise<TermData[]>
}
```

Mặc định người dùng nhập tay mọi thứ. Chọn cơ sở giáo dục lúc đăng ký thì mở khoá adapter tương ứng để nhập nhanh.

Adapter Macquarie có sẵn mã dùng lại được từ `mqcalendarremake` — đọc `unitguides.mq.edu.au` bằng JSDOM, lấy mã môn, kỳ, năm và bảng assessment kèm trọng số. Port sang khớp interface trên khoảng một ngày.

---

## 6. Tầng UI

Trang điều hướng, dashboard, form, lịch: **React thông thường**.

Editor và diagram: **island imperative** — React giữ một `<div>` bằng `useRef` rồi giao hẳn quyền điều khiển cho JS thuần. Đây không chỉ là lựa chọn tối ưu mà là bắt buộc: `monaco-vscode-api` tự gắn vào một DOM node và sở hữu node đó, React can thiệp vào bên trong là hỏng.

Ba quy tắc giữ ranh giới:

1. **Container bất động** — cái `<div>` giữ bằng ref không nhận `key` đổi, không nằm dưới điều kiện render, không nhận prop ảnh hưởng tới nó. React dựng một lần rồi không đụng tới nữa.
2. **Ranh giới là một handle rõ ràng** — React gọi vào island qua các phương thức trên handle; island báo ngược ra bằng callback. Không có đường thứ ba.
3. **Recorder móc vào tầng imperative, không móc vào React** — sự kiện lấy thẳng từ `onDidChangeModelContent` và từ tầng thao tác của React Flow, không phải từ `useEffect` quan sát state. Nhờ vậy việc ghi nhận độc lập hoàn toàn với vòng đời render.

---

## 7. Công cụ và thư viện

### Coding — `@codingame/monaco-vscode-api`

Không dùng `monaco-editor` đóng gói sẵn. Thư viện này tách Monaco ra kèm tầng service thật của VS Code:

- `initialize()` nhận các service override (`getConfigurationServiceOverride()`, `getThemeServiceOverride()`, …) — can thiệp được vào service thay vì bị khoá cứng
- **workbench service** dựng nguyên layout VS Code kèm activity bar, sidebar, panel, status bar (loại trừ lẫn nhau với editor+views service — phải chọn một)
- chạy được extension VS Code thật, qua VSIX hoặc `registerExtension()`
- `registerFileSystemOverlay()` cho phép cắm file system ảo, tức file sinh viên nằm trong DB thay vì trên đĩa — khớp với quy tắc tương thích AWS ở §3

Chọn hướng này còn giữ nguyên đường chuyển sang Electron nếu dự án đi tiếp.

**Rủi ro:** thư viện đòi bundler nạp CSS của VS Code dạng chuỗi thay vì tiêm vào `<head>`. Chỗ này Next.js có thể vướng — xem mốc chặn ở §9 và phương án lùi ở §10.

### Diagram — React Flow

Dùng lại dự án React Flow sẵn có của thành viên trong nhóm. Cần rà trong tuần 1 để xác định tình trạng và điểm móc recorder.

### Nền tảng

Next.js · React · TypeScript · Tailwind · Prisma · PostgreSQL (Docker) · zod

---

## 8. Phân công

Hai người ngang hàng, cắt theo trục dọc. Điểm chạm duy nhất là đặc tả op-log ở §4; chốt xong thì hai bên chạy song song không chặn nhau.

| | **Nguyên — Core & công cụ soạn mã** | **Duy — Hạ tầng, dữ liệu & công cụ sơ đồ** |
|---|---|---|
| Tuần 1 | Đặc tả op-log, lớp host công cụ, spike `monaco-vscode-api` | Auth, dữ liệu mẫu, API nhận sự kiện |
| Tuần 2 | Recorder soạn mã đầy đủ, phát lại + mốc hash | Lịch, export `.ics`, adapter theo trường, API đọc lại + kiểm quyền |
| Tuần 3 | Cờ bất thường, phần tua theo vai trò | Công cụ sơ đồ + recorder, trang danh sách bài nộp, chấm điểm |
| Tuần 4 | Ghép, sửa lỗi | Ghép, dữ liệu demo, chuẩn bị trình bày |

**Nguyên** giữ phần lõi: đặc tả sự kiện, lớp nạp và chạy công cụ, hợp đồng giữa nền tảng với công cụ — cộng công cụ soạn mã và toàn bộ recorder engine.

**Duy** giữ mọi thứ dưới lớp lõi: Docker, Prisma, mô hình dữ liệu, đăng nhập, lịch — cộng công cụ sơ đồ, vốn đã có sẵn phần vẽ từ dự án React Flow của Duy.

---

## 9. Lịch 4 tuần

### Tuần 1 — Nền móng (21–28/08)

- **Ngày 1–2, cả hai:** chốt đặc tả `SessionEvent` và schema v1
- **Nguyên:** spike `monaco-vscode-api` trong Next.js **Mốc chặn — hết ngày 3 phải render được workbench và override được ít nhất một service.** Không đạt thì chuyển sang phương án lùi ngay, không kéo dài
- **Duy:** đăng nhập email + mật khẩu, seed một cơ sở / một môn / một assessment, API nhận lô sự kiện *(Docker và Prisma đã xong)*
- **Nghiệm thu:** gõ trong editor, sự kiện lên tới server, thấy bản ghi trong DB

### Tuần 2 — Tua lại được (29/08–04/09)

- **Nguyên:** recorder đầy đủ (edit, selection, paste trong/ngoài, save kèm hash) và phát lại trong công cụ
- **Duy:** mô hình lịch, export `.ics`, adapter theo trường, CRUD offering và assessment, API đọc lại kèm kiểm quyền
- **Nghiệm thu:** tua lại trọn vẹn một phiên coding, khớp mọi mốc hash

Đây là mốc quan trọng nhất của dự án. Nếu hết tuần 2 chưa tua lại được, dừng mọi việc khác cho tới khi nó chạy — không có phần này thì không còn gì để trình bày.

### Tuần 3 — Đủ vòng (05–11/09)

- **Nguyên:** bốn cờ bất thường, phần tua theo dòng thời gian hiện ra khi vai trò là người chấm
- **Duy:** công cụ sơ đồ + recorder cho nó, trang danh sách bài nộp, ghi note và chấm điểm

> Không dựng màn hình chấm bài riêng. Phần tua lại nằm trong chính công cụ, hiện ra khi vai trò người mở là người chấm — xem `architecture.md` §6. Nền tảng chỉ cần trang danh sách để bấm vào, cộng phần kiểm quyền ở máy chủ.
- **Nghiệm thu:** giảng viên mở bài của sinh viên, tua lại, thấy cờ, chấm xong
- **Đóng băng tính năng.** Sau mốc này chỉ sửa lỗi và hoàn thiện

### Tuần 4 — Hoàn thiện (12–21/09)

Ghép các phần, dựng dữ liệu mẫu, chạy thử toàn luồng, sửa lỗi, chuẩn bị tài liệu và bản trình bày.

---

## 10. Rủi ro

| Rủi ro | Dấu hiệu | Phương án |
|---|---|---|
| `monaco-vscode-api` không tương thích Next.js (CSS/bundler) | Hết ngày 3 tuần 1 chưa render được | Về `monaco-editor` thuần, tự dựng layout. Phần ghi nhận không mất gì vì recorder móc vào Monaco chứ không vào workbench |
| Dự án React Flow không ở trạng thái dùng được | Rà tuần 1 thấy dở dang | Tự viết canvas node/edge tối giản, khoảng 3 ngày |
| Replay lệch, hash không khớp | Mốc kiểm chứng báo đỏ | Sửa recorder. Đây đúng là việc mốc kiểm chứng sinh ra để làm |
| Phần lịch ăn hết thời gian của Duy | Cuối tuần 2 chưa xong | Cắt Gantt và thời khoá biểu tuần; giữ deadline, sự kiện tự thêm, export `.ics` |
| Phạm vi phình ra | Tuần 3 vẫn đang thêm tính năng | Đóng băng tính năng cuối tuần 3, không có ngoại lệ |

Rủi ro lớn nhất không nằm trong bảng: **đầu tư quá sâu vào các phần không nằm trên luồng chính.** Chỉ op-log đáng làm kỹ; mọi thứ khác làm ở mức chạy được rồi đi tiếp.

---

## 11. Hướng phát triển sau demo

Nếu dự án đi tiếp: thêm công cụ (docs, LaTeX), hệ thống nội dung theo tuần cho từng môn, note của sinh viên, và một tầng AI đọc toàn bộ dữ liệu đó để lập kế hoạch học tập.

Điều này không cần xây gì bây giờ, nhưng có một hệ quả cho hôm nay: nếu mọi thứ sinh viên tạo ra đều nằm trong **một kho sự kiện thống nhất, có mốc thời gian, gắn với môn và assessment**, thì bước sau có sẵn dữ liệu để dùng. Nếu mỗi công cụ tự lưu một kiểu, bước sau sẽ phải bắt đầu bằng việc di trú dữ liệu.

---

## 12. Việc cần làm ngay

- [ ] Chốt đặc tả `SessionEvent` — cả hai người, ngày 1–2
- [ ] Chia vai A / B
- [ ] Rà dự án React Flow của thành viên nhóm, xác định điểm móc recorder
- [x] ~~Dựng repo, Docker Postgres, Prisma schema v1~~ — xong 22/08
- [ ] Spike `monaco-vscode-api` trong Next.js — mốc chặn ngày 3

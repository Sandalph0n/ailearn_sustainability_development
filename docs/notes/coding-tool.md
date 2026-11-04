# Ghi chú triển khai — công cụ soạn mã (`code`)

Chỉ nói về bên trong công cụ này. Phần nền tảng và hợp đồng xem [architecture.md](../architecture.md).

---

## Thư viện: `@codingame/monaco-vscode-api`

Không dùng `monaco-editor` đóng gói sẵn. Thư viện này tách Monaco ra kèm **tầng service thật** của VS Code, cho phép:

- `initialize()` nhận các service override (`getConfigurationServiceOverride()`, `getThemeServiceOverride()`, …) — can thiệp vào service thay vì bị khoá cứng
- **workbench service** dựng nguyên bố cục VS Code kèm activity bar, sidebar, panel, status bar (loại trừ lẫn nhau với editor+views service — phải chọn một)
- chạy được extension VS Code thật (VSIX hoặc `registerExtension()`)
- `registerFileSystemOverlay()` — cắm hệ thống tệp ảo, tức tài liệu lấy từ API của nền tảng chứ không từ đĩa

Bản đã kiểm: **36.1.1**.

### Rủi ro chưa gỡ

Thư viện đòi bundler nạp CSS của VS Code **dạng chuỗi** thay vì tiêm vào `<head>`. Next.js có thể vướng chỗ này.

**Đây là mốc chặn của tuần 1.** Không dựng được workbench trong Next.js trong ba ngày đầu thì lùi về `monaco-editor` thuần và tự dựng bố cục. Phần ghi nhận không mất gì, vì recorder móc vào Monaco chứ không móc vào workbench.

---

## Phân biệt dán từ trong / từ ngoài

Đây là phần dễ vỡ nhất của công cụ này. Đã kiểm trực tiếp trên gói 36.1.1.

### Cơ chế

Dùng `DocumentPasteEditProvider`:

- `prepareDocumentPaste` — gắn một nhãn riêng vào dữ liệu lúc **copy**
- `provideDocumentPasteEdits` — kiểm nhãn đó lúc **paste**

Có nhãn = nội dung xuất phát từ chính trang này. Không có nhãn = từ nguồn ngoài.

**Không đọc clipboard lần nào.** Đây là điểm quan trọng về mặt riêng tư, và cũng là lý do cách này khả thi trên web.

### Bốn điều đã xác minh

| Điều | Kết quả |
|---|---|
| `registerDocumentPasteEditProvider` có trong API | Có, tại `extHost.api.impl.js:720` |
| Có bị khoá sau proposed API không | **Không** — không có `checkProposedApiEnabled` (các API proposed thật sự trong cùng file thì có) |
| `CopyPasteController` có nối dây không | Có — đăng ký qua `registerEditorContribution` |
| Có cần dựng extension host không | **Không** — đăng ký thẳng vào `languageFeaturesService.documentPasteEditProvider` |

Điểm cuối tiết kiệm đáng kể: không phải viết extension rồi dựng extension host chỉ để có phép phân biệt này.

### ⚠️ Cái bẫy: nhãn phải khai ở CẢ HAI danh sách mime

Trực giác nói `copyMimeTypes: [MARK]` (thứ ta gắn) và `pasteMimeTypes: ['text/plain']` (thứ ta đọc) là đủ. **Sai, và sai một cách im lặng** — mọi lần dán đều bị chấm là "từ ngoài", kể cả chép dòng trên dán xuống dòng dưới.

Lý do nằm ở `copyPasteController.js:451`:

```js
_currentCopyOperation.operations
  .filter(op => allProviders.some(provider =>
      provider.pasteMimeTypes.some(type => matchesMimeType(type, op.providerMimeTypes))))
```

Lúc dán, controller chỉ nhập những phần dữ liệu mà **có provider nào đó khai là mình cần đọc**. Nhãn của ta do chính ta gắn và cũng chỉ mình ta đọc — không tự khai `MARK` trong `pasteMimeTypes` thì không ai khai cả, và nó bị lọc bỏ trước khi tới tay.

`text/plain` vẫn cần: đó là thứ đưa ta vào danh sách provider được gọi.

**Hai mime làm hai việc khác nhau, thiếu cái nào cũng hỏng.**

### Giới hạn đã biết

Cơ chế nhận biết "từ trong" dựa vào một biến static trong bộ nhớ trang:

```js
CopyPasteController._currentCopyOperation = { handle, operations }
```

Copy từ ứng dụng khác thì không có biến này → không có nhãn → tính là từ ngoài. Đó chính là phép phân biệt.

Nhưng cũng có nghĩa là:

| Tình huống | Bị chấm là |
|---|---|
| Copy ở tab khác **của chính ứng dụng ta** | "từ ngoài" |
| Copy → tải lại trang → dán | "từ ngoài" |

Trên web, tải lại trang là chuyện thường xuyên, nên số dương-tính-giả sẽ cao hơn hẳn so với ứng dụng để bàn.

Không phải lỗi cần sửa — chỉ cần nhớ khi diễn giải, và cờ vốn là câu hỏi chứ không phải kết luận. Nếu về sau muốn giảm nhiễu, có thể lưu vân tay đoạn vừa copy vào `sessionStorage` để nhận lại sau khi tải trang. **Chưa nên làm** — thêm phức tạp cho một trường hợp biên.

---

## Nguồn sự kiện

`onDidChangeModelContent` của Monaco trả về sẵn phép sửa tối thiểu:

```ts
changes: [{ range, rangeOffset, rangeLength, text }]
```

**Không tự diff, không chụp ảnh định kỳ.** Dữ liệu này chính xác tuyệt đối và mịn hơn bất kỳ cách suy ra nào.

### Sự kiện dự kiến phát ra

| `type` | `payload` | nhịp |
|---|---|---|
| `edit` | `{ rangeOffset, rangeLength, text }` | gộp phím liên tiếp trong 2s |
| `selection` | `{ anchor, active }` | gộp 250ms; bỏ chọn ghi ngay |
| `paste` | `{ length, origin: 'internal' \| 'external' }` | tức thì |
| `save` | `{ hash }` | tức thì — đây là mốc kiểm chứng |
| `doc-open` / `doc-close` | `{ path }` | tức thì |

**Chỉ ghi vùng bôi đen, không ghi vị trí con trỏ.** Vị trí con trỏ sau một phép sửa suy ra được từ chính phép sửa đó; ghi lại chỉ làm log phình mà không thêm thông tin. Vùng bôi đen thì không suy ra được từ đâu, và nó cho biết người dùng đang nhắm vào đoạn nào.

Hai nhịp gộp khác nhau là cố ý: kéo chuột bắn ra hàng chục sự kiện trung gian, chỉ vị trí dừng mới đáng giữ — nhưng thiếu bản ghi lúc bỏ chọn thì khi phát lại vệt tô sáng sẽ đứng nguyên mãi.

---

## Việc cần làm

- [ ] Spike `monaco-vscode-api` trong Next.js — **mốc chặn ngày 3 tuần 1**
- [ ] Dựng workbench, override ít nhất một service
- [ ] Cắm `registerFileSystemOverlay()` vào API tài liệu của nền tảng
- [ ] Recorder: `edit`, `selection`, `save` + hash
- [ ] Provider phân biệt dán — nhớ khai `MARK` ở **cả hai** danh sách mime
- [ ] Phát lại: dựng lại nội dung từ chuỗi sự kiện, so mốc hash
- [ ] Phần tua theo dòng thời gian, chỉ hiện khi `ctx.role === 'MARKER'`

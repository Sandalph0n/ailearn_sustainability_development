// File này định nghĩa giao diện chung cho mọi adapter đọc danh mục môn của một cơ sở.

/** Một môn học lấy từ danh mục công khai của cơ sở, đã chuẩn hoá để đổ thẳng vào form Subject. */
export type CatalogSubject = {
    subjectCode: string;
    subjectName: string;
    /** Đã cắt cho vừa giới hạn 1000 ký tự của `Subject.subjectDescription`. */
    subjectDescription: string | null;
    /** Năm của bản danh mục đã trả lời — có thể là năm trước nếu năm hiện tại chưa công bố. */
    year: number;
    sourceUrl: string;
};

export type CatalogLookupResult =
    | { ok: true; subject: CatalogSubject }
    | { ok: false; reason: 'not_found' }
    /** Nguồn không trả lời, hoặc trả lời nhưng cấu trúc trang đã đổi. */
    | { ok: false; reason: 'unavailable' };

/**
 * Mỗi cơ sở có adapter riêng vì không cơ sở nào có API chính thức: tất cả đều là đọc HTML công
 * khai, và markup của từng trường một khác.
 */
export type CatalogAdapter = {
    id: string;
    /** Tên nguồn hiện trên nút bấm, ví dụ "Macquarie Handbook". */
    label: string;
    /** Adapter nào nhận một cơ sở là dựa vào website đã khai của cơ sở đó. */
    matchesWebsite: (website: string) => boolean;
    findSubject: (code: string, options?: { year?: number }) => Promise<CatalogLookupResult>;
};

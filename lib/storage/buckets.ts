// File này ánh xạ tên bucket sang biến môi trường, và là nơi DUY NHẤT biết bucket nào tên gì.
import 'server-only';

/**
 * Bốn bucket của hệ thống, gọi bằng vai trò chứ không bằng tên thật.
 *
 * ─── Vì sao không dùng thẳng tên ─────────────────────────────────────────────
 *
 * Trên AWS, tên bucket là duy nhất TOÀN CẦU — không phải trong tài khoản của bạn mà trên toàn
 * thế giới. `ailearn-docs` gần như chắc chắn đã có người lấy, nên khi triển khai thật tên sẽ
 * khác. Mã nguồn nói `'docs'`, còn tên thật nằm ở `.env`.
 */
export type StorageBucket = 'media' | 'docs' | 'tools' | 'archive';

const ENV_VAR: Record<StorageBucket, string> = {
    media: 'S3_BUCKET_MEDIA',
    docs: 'S3_BUCKET_DOCS',
    tools: 'S3_BUCKET_TOOLS',
    archive: 'S3_BUCKET_ARCHIVE',
};

/**
 * Tên thật của một bucket.
 *
 * Đọc biến môi trường tại thời điểm GỌI chứ không phải lúc nạp module: nạp module xảy ra cả
 * trong lúc `next build`, khi máy build có thể chưa có `.env` nào cả.
 */
export function bucketName(bucket: StorageBucket): string {
    const name = process.env[ENV_VAR[bucket]];
    if (!name) {
        throw new Error(`${ENV_VAR[bucket]} is missing from .env`);
    }
    return name;
}

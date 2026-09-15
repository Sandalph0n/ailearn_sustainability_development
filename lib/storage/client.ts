// File này khởi tạo S3Client dùng chung cho toàn bộ mã chạy phía server.
import 'server-only';

import { S3Client } from '@aws-sdk/client-s3';

/**
 * Một thể hiện S3Client dùng chung.
 *
 * ─── Vì sao giữ trên `globalThis` ────────────────────────────────────────────
 *
 * Cùng lý do với `lib/db.ts`: Next.js ở chế độ dev nạp lại module mỗi lần sửa file, và mỗi lần
 * nạp lại sẽ tạo thêm một client kèm pool kết nối HTTP riêng. Sau vài chục lần lưu file là một
 * đống socket bỏ hoang.
 */
const globalForS3 = globalThis as unknown as { s3?: S3Client };

function create(): S3Client {
    const region = process.env.S3_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!region) {
        throw new Error('S3_REGION is missing from the environment');
    }

    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
        throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be provided together');
    }

    // `S3_ENDPOINT` chỉ có ở máy dev, trỏ tới container MinIO. Trên AWS thì bỏ biến đó đi và SDK
    // tự tìm S3 thật theo `region`.
    const endpoint = process.env.S3_ENDPOINT;

    return new S3Client({
        region,
        endpoint,
        // MinIO nhận địa chỉ dạng `host/bucket`; S3 thật muốn `bucket.host`. Bật cờ này đúng lúc
        // có endpoint riêng, để cùng một mã chạy được ở cả hai nơi.
        forcePathStyle: Boolean(endpoint),
        // Local MinIO uses the explicit pair from `.env`. On AWS, omitting both values lets the
        // SDK use App Runner's short-lived instance-role credentials instead of a stored key.
        credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
}

export const s3 = globalForS3.s3 ?? create();

if (process.env.NODE_ENV !== 'production') {
    globalForS3.s3 = s3;
}

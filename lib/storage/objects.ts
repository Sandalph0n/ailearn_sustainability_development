// File này bọc ba thao tác kho tệp mà ứng dụng thật sự dùng. Mỏng, và không biết gì về nghiệp vụ.
import 'server-only';

import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';

import { bucketName, type StorageBucket } from '@/lib/storage/buckets';
import { s3 } from '@/lib/storage/client';

type ObjectRef = {
    bucket: StorageBucket;
    key: string;
};

/**
 * Ghi một đối tượng. Trùng khoá là GHI ĐÈ, không báo lỗi — S3 không có khái niệm "đã tồn tại".
 *
 * `contentType` bắt buộc vì nó là thứ duy nhất cho biết tệp này là ảnh gì. Thiếu thì S3 mặc định
 * `application/octet-stream` và trình duyệt sẽ tải về thay vì hiển thị.
 */
export async function putObject({
    bucket,
    key,
    body,
    contentType,
}: ObjectRef & {
    body: Uint8Array;
    contentType: string;
}): Promise<void> {
    await s3.send(
        new PutObjectCommand({
            Bucket: bucketName(bucket),
            Key: key,
            Body: body,
            ContentType: contentType,
        }),
    );
}

export type StoredObject = {
    body: ReadableStream<Uint8Array>;
    contentType: string;
    contentLength: number | undefined;
};

/**
 * Đọc một đối tượng, hoặc `null` khi không có.
 *
 * ─── Vì sao trả `null` chứ không ném lỗi ─────────────────────────────────────
 *
 * "Không có" là kết quả bình thường ở đây: một dòng database trỏ vào đối tượng đã bị dọn, một
 * người vừa xoá ảnh. Bắt phía gọi dùng `try/catch` cho nhánh thường gặp là đẩy luồng điều khiển
 * vào chỗ khó đọc. Lỗi thật — mất mạng, sai khoá truy cập — vẫn ném ra như cũ.
 */
export async function getObject({ bucket, key }: ObjectRef): Promise<StoredObject | null> {
    let output: GetObjectCommandOutput;

    try {
        output = await s3.send(new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }));
    } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
    }

    // `Body` khai kiểu là optional vì SDK dùng chung một kiểu cho mọi môi trường chạy. Trên Node
    // thì phản hồi 200 luôn có body.
    if (!output.Body) return null;

    return {
        body: output.Body.transformToWebStream(),
        contentType: output.ContentType ?? 'application/octet-stream',
        contentLength: output.ContentLength,
    };
}

/** Xoá. Khoá không tồn tại cũng thành công — S3 coi đó là đã đạt trạng thái mong muốn. */
export async function deleteObject({ bucket, key }: ObjectRef): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }));
}

/**
 * S3 báo "không có khoá này" theo hai cách khác nhau tuỳ thao tác: `NoSuchKey` khi đọc một khoá,
 * `NotFound` khi hỏi siêu dữ liệu. Kiểm cả mã trạng thái để không phụ thuộc vào chuỗi tên lỗi.
 */
function isNotFound(error: unknown): boolean {
    const name = (error as { name?: string })?.name;
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    return name === 'NoSuchKey' || name === 'NotFound' || status === 404;
}

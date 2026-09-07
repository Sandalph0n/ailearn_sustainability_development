import 'server-only';

import { deleteObject, putObject } from '@/lib/storage/objects';
import type { InspectedToolPackage } from '@/lib/tools/package';

export type StoredToolPackage = {
    archiveKey: string;
    storagePrefix: string;
    objectKeys: string[];
};

export async function storeToolPackage({
    toolId,
    versionId,
    archive,
    inspected,
}: {
    toolId: string;
    versionId: string;
    archive: Uint8Array;
    inspected: InspectedToolPackage;
}): Promise<StoredToolPackage> {
    const base = `tool-versions/${toolId}/${versionId}`;
    const archiveKey = `${base}/package.zip`;
    const storagePrefix = `${base}/files/`;
    const objectKeys: string[] = [];

    try {
        await putObject({
            bucket: 'tools',
            key: archiveKey,
            body: archive,
            contentType: 'application/zip',
        });
        objectKeys.push(archiveKey);

        // Giới hạn concurrency để một ZIP nhiều file nhỏ không làm cạn socket tới S3/MinIO.
        for (let offset = 0; offset < inspected.files.length; offset += 8) {
            const batch = inspected.files.slice(offset, offset + 8);
            // Chờ CẢ batch kết thúc trước khi cleanup. `Promise.all` trả sớm khi một upload lỗi,
            // khiến các upload còn lại có thể ghi object SAU lúc cleanup và để lại rác.
            const results = await Promise.allSettled(
                batch.map(async (file) => {
                    const key = `${storagePrefix}${file.path}`;
                    await putObject({
                        bucket: 'tools',
                        key,
                        body: file.bytes,
                        contentType: file.contentType,
                    });
                    return key;
                }),
            );
            for (const result of results) {
                if (result.status === 'fulfilled') objectKeys.push(result.value);
            }
            const failed = results.find((result) => result.status === 'rejected');
            if (failed?.status === 'rejected') throw failed.reason;
        }

        return { archiveKey, storagePrefix, objectKeys };
    } catch (error) {
        await removeToolPackageObjects(objectKeys);
        throw error;
    }
}

export async function removeToolPackageObjects(keys: string[]): Promise<void> {
    await Promise.allSettled(keys.map((key) => deleteObject({ bucket: 'tools', key })));
}

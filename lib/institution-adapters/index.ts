// File này là nơi duy nhất biết cơ sở nào có adapter danh mục.
import { macquarieAdapter } from './macquarie';
import type { CatalogAdapter } from './types';

export type { CatalogAdapter, CatalogLookupResult, CatalogSubject } from './types';

const ADAPTERS: readonly CatalogAdapter[] = [macquarieAdapter];

/**
 * Chọn adapter theo website của cơ sở.
 *
 * Chưa có cột riêng trên `Institution` vì mới có một adapter; website là dữ liệu đã có sẵn và
 * seed Macquarie đã điền `https://www.mq.edu.au/`. Khi có adapter thứ hai mà hai trường dùng
 * chung domain (hiếm) thì mới đáng thêm cột.
 */
export function adapterForInstitution(institution: {
    website: string | null;
}): CatalogAdapter | null {
    const website = institution.website;
    if (!website) return null;
    return ADAPTERS.find((adapter) => adapter.matchesWebsite(website)) ?? null;
}

/** Phần adapter mà client được biết: đủ để hiện nút, không kèm hàm fetch. */
export type CatalogInfo = { id: string; label: string };

export function catalogInfoFor(institution: { website: string | null }): CatalogInfo | null {
    const adapter = adapterForInstitution(institution);
    return adapter ? { id: adapter.id, label: adapter.label } : null;
}

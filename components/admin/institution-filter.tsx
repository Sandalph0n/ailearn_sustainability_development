'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

import { useListQuery } from '@/components/admin/use-list-query';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export type InstitutionOption = { id: string; name: string };

/**
 * Ánh xạ id → tên cho prop `items` của Base UI `Select`.
 *
 * Không có nó thì ô hiện GIÁ TRỊ THÔ (một chuỗi uuid) mỗi khi đã có lựa chọn sẵn — Base UI chỉ
 * biết nhãn của một mục sau khi popup mở lần đầu.
 */
export function institutionItems(institutions: InstitutionOption[]): Record<string, string> {
    return Object.fromEntries(
        institutions.map((institution) => [institution.id, institution.name]),
    );
}

/**
 * Lọc một bảng theo cơ sở giáo dục, trạng thái nằm trên URL.
 *
 * ─── Vì sao một bộ lọc thay vì mỗi trường một trang riêng ───────────────────
 *
 * `Subject`, `StudyTerm`, `Role` đều thuộc về một cơ sở. Cách hiển nhiên là cho mỗi trường một
 * bộ trang riêng dưới `/admin/institutions/<id>/…`, nhưng như vậy là sáu bộ CRUD gần như giống
 * hệt nhau, và người quản trị toàn hệ thống mất khả năng nhìn tất cả cùng lúc.
 *
 * Một trang kèm bộ lọc làm được cả hai: bỏ trống thì thấy toàn hệ thống, chọn một trường thì
 * thành đúng trang của trường đó. Trang chi tiết cơ sở chỉ việc trỏ tới `?institution=<id>`.
 */
export function InstitutionFilter({
    institutions,
    value,
}: {
    institutions: InstitutionOption[];
    /** Id đang chọn, `null` là "tất cả". */
    value: string | null;
}) {
    const list = useListQuery();

    return (
        <div className="flex shrink-0 items-center gap-1">
            <Select
                // Không có `items` thì ô hiện uuid thay vì tên — xem chú thích ở `FormSelect`.
                items={institutionItems(institutions)}
                value={value ?? ''}
                onValueChange={(next) =>
                    // Đổi bộ lọc thì về trang 1: đang ở trang 5 mà lọc còn 2 trang sẽ ra bảng trống.
                    list.setParams({ institution: next || null, page: null })
                }
            >
                <SelectTrigger className="w-52" aria-label="Filter by institution">
                    <SelectValue placeholder="All institutions" />
                </SelectTrigger>
                <SelectContent>
                    {institutions.map((institution) => (
                        <SelectItem key={institution.id} value={institution.id}>
                            {institution.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/*
                Nút xoá bộ lọc đứng riêng, chỉ hiện khi đang lọc. Đặt một mục "All institutions"
                vào trong Select cũng được, nhưng Base UI coi chuỗi rỗng là "chưa chọn" nên nó
                không giữ được giá trị đó.
            */}
            {value && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear institution filter"
                    onClick={() => list.setParams({ institution: null, page: null })}
                >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
            )}
        </div>
    );
}

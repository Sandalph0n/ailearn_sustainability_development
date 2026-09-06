import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Alert02Icon,
    Shield01Icon,
    Tick02Icon,
    UniversityIcon,
} from '@hugeicons/core-free-icons';

import {
    contextKey,
    distinctRoleContexts,
    roleSearchParams,
    type ContextOption,
} from '@/lib/context/context-params';

/**
 * Bảng chọn quyền trên chính trang bảng điều khiển: đang ở TRƯỜNG nào, dưới VAI TRÒ nào.
 *
 * ─── Vì sao có cả cái này lẫn bộ chọn trên header ────────────────────────────
 *
 * Hai việc khác nhau. Trên header là để ĐỔI NHANH khi đã biết mình có gì — nhỏ, luôn ở đó, không
 * chiếm chỗ. Ở đây là để NHÌN TOÀN CẢNH: bao nhiêu trường, mỗi trường những vai trò nào, cái nào
 * giới hạn trong một môn cụ thể. Một danh sách xổ xuống không trả lời được câu hỏi đó.
 *
 * ─── Vì sao là `<Link>` chứ không phải nút gọi router ────────────────────────
 *
 * Trang này là Server Component và đã có sẵn ngữ cảnh đã kiểm, nên mỗi lựa chọn viết thẳng ra
 * được thành một URL thật. Đổi lại ba thứ mà nút bấm không có: mở được ở tab mới, sao chép gửi
 * cho người khác được, và nút Back của trình duyệt quay lại đúng vai trò trước đó.
 *
 * Bộ chọn trên header phải dùng router vì nó nằm trong layout — nơi không biết đường dẫn hiện
 * tại lúc dựng, nên không viết sẵn href được.
 */
export function AccessPicker({
    options,
    active,
    corrected,
    pathname = '/navigation/dashboard',
}: {
    options: ContextOption[];
    active: ContextOption | null;
    /** URL yêu cầu một ngữ cảnh không có thật và đã bị thay bằng mặc định. */
    corrected: boolean;
    pathname?: string;
}) {
    if (options.length === 0) {
        return (
            <section className="border-border/70 flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
                <div className="bg-brand-teal/10 mb-1 flex size-11 items-center justify-center rounded-lg">
                    <HugeiconsIcon
                        icon={Shield01Icon}
                        strokeWidth={2}
                        className="text-brand-teal size-5"
                    />
                </div>
                <p className="text-sm font-medium">No role yet</p>
                <p className="text-muted-foreground max-w-md text-sm">
                    You are signed in, but not yet a member of any institution. Once an
                    administrator grants you a role — or your email matches one granted
                    automatically — it appears here and you can choose which one to work under.
                </p>
            </section>
        );
    }

    const roleOptions = distinctRoleContexts(options);

    // Gom theo cơ sở, giữ thứ tự máy chủ đã sắp.
    const grouped = new Map<string, { name: string; items: ContextOption[] }>();
    for (const option of roleOptions) {
        const bucket = grouped.get(option.institution.id);
        if (bucket) {
            bucket.items.push(option);
        } else {
            grouped.set(option.institution.id, { name: option.institution.name, items: [option] });
        }
    }

    function hrefFor(option: ContextOption): string {
        return pathname + '?' + new URLSearchParams(roleSearchParams(option)).toString();
    }

    return (
        <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
                <span aria-hidden className="bg-brand-teal h-4 w-1 rounded-xs" />
                <h2 className="font-heading text-lg font-medium">Your access</h2>
                <span className="text-muted-foreground text-sm">
                    {roleOptions.length} {roleOptions.length === 1 ? 'role' : 'roles'} across{' '}
                    {grouped.size} {grouped.size === 1 ? 'institution' : 'institutions'}
                </span>
            </div>

            {corrected && (
                <p className="text-brand-amber bg-brand-amber/10 border-brand-amber/30 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                    <HugeiconsIcon
                        icon={Alert02Icon}
                        strokeWidth={2}
                        className="mt-0.5 size-4 shrink-0"
                    />
                    That link asked for a role you do not hold, so the first one below is being used
                    instead.
                </p>
            )}

            {Array.from(grouped.values()).map((group) => (
                <div key={group.name} className="flex flex-col gap-2">
                    <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                        <HugeiconsIcon icon={UniversityIcon} strokeWidth={2} className="size-3.5" />
                        {group.name}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {group.items.map((option) => {
                            const key = contextKey(option);
                            const isActive = active
                                ? option.assignmentId === active.assignmentId
                                : false;

                            return (
                                <Link
                                    key={key}
                                    href={hrefFor(option)}
                                    aria-current={isActive ? 'true' : undefined}
                                    className={
                                        'bg-card relative flex flex-col gap-1 rounded-lg border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ' +
                                        (isActive
                                            ? 'border-brand-teal/60 ring-brand-teal/20 ring-2'
                                            : 'hover:border-brand-teal/40')
                                    }
                                >
                                    {isActive && (
                                        <span className="bg-brand-teal/12 text-brand-teal absolute top-3 right-3 flex size-6 items-center justify-center rounded-md">
                                            <HugeiconsIcon
                                                icon={Tick02Icon}
                                                strokeWidth={2}
                                                className="size-3.5"
                                            />
                                        </span>
                                    )}

                                    <span className="font-heading pr-8 font-semibold">
                                        {option.role.roleName}
                                    </span>

                                    <span className="text-muted-foreground text-sm">
                                        {option.role.scopeType === 'INSTITUTION'
                                            ? 'Institution role'
                                            : 'Offering role'}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            ))}
        </section>
    );
}

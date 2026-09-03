'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Dải tab giữa các trang con của một cơ sở.
 *
 * Để thành DỮ LIỆU — thêm một mục là thêm một dòng. Mục chưa dựng thì mờ đi và không bấm được,
 * chứ không giả vờ là liên kết rồi dẫn tới 404.
 */
const TABS = [
    { segment: '', label: 'Setup', ready: true },
    { segment: '/subjects', label: 'Subjects', ready: true },
    { segment: '/terms', label: 'Terms', ready: true },
    { segment: '/roles', label: 'Roles', ready: true },
    { segment: '/offerings', label: 'Offerings', ready: true },
    { segment: '/people', label: 'People', ready: true },
    { segment: '/requests', label: 'Requests', ready: true },
] as const;

export function InstitutionTabs({ institutionId }: { institutionId: string }) {
    const pathname = usePathname();
    const base = `/admin/institutions/${institutionId}`;

    return (
        // `overflow-x-auto` để dải tab tự cuộn trên màn hình hẹp thay vì đẩy vỡ trang.
        <nav className="border-border -mb-px flex gap-1 overflow-x-auto border-b">
            {TABS.map((tab) => {
                const href = `${base}${tab.segment}`;
                // So khớp CHÍNH XÁC: `base` là tiền tố của mọi tab khác nên nó sẽ luôn sáng.
                const active = pathname === href;

                const className = cn(
                    'shrink-0 border-b-2 px-3 py-2 text-sm transition-colors',
                    active
                        ? 'border-primary text-foreground font-medium'
                        : 'border-transparent text-muted-foreground',
                    tab.ready ? 'hover:text-foreground' : 'cursor-default opacity-50',
                );

                return tab.ready ? (
                    <Link key={tab.label} href={href} className={className}>
                        {tab.label}
                    </Link>
                ) : (
                    <span key={tab.label} className={className} aria-disabled>
                        {tab.label}
                    </span>
                );
            })}
        </nav>
    );
}

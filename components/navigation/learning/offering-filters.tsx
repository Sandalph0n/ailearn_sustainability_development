'use client';

import { useListQuery } from '@/components/admin/use-list-query';
import { UrlSelectFilter } from '@/components/admin/url-select-filter';
import { Input } from '@/components/ui/input';

export type OfferingStatusFilter = 'all' | 'current' | 'upcoming' | 'past';

export function OfferingFilters({
    status,
    resultCount,
}: {
    status: OfferingStatusFilter;
    resultCount: number;
}) {
    const list = useListQuery();

    return (
        <div className="mb-6 flex flex-wrap items-center gap-2 border-y py-3">
            <Input
                value={list.input}
                onChange={(event) => list.setInput(event.target.value)}
                placeholder="Search by code or subject name…"
                aria-label="Search accessible subjects"
                className="w-full sm:max-w-72"
            />
            <UrlSelectFilter
                value={status}
                options={[
                    { value: 'all', label: 'All study periods' },
                    { value: 'current', label: 'Current' },
                    { value: 'upcoming', label: 'Upcoming' },
                    { value: 'past', label: 'Past' },
                ]}
                placeholder="All study periods"
                ariaLabel="Filter by study period"
                clearable={false}
                onChange={(next) => list.setParams({ status: next === 'all' ? null : next })}
                className="w-48"
            />
            <span className="text-muted-foreground ml-auto text-sm tabular-nums">
                {resultCount} result{resultCount === 1 ? '' : 's'}
            </span>
        </div>
    );
}

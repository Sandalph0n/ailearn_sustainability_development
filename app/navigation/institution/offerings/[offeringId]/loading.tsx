import { Skeleton } from '@/components/ui/skeleton';

export default function OfferingAssessmentsLoading() {
    return (
        <main
            className="mx-auto w-full max-w-7xl py-7"
            aria-busy="true"
            aria-label="Loading assessment management"
        >
            <div className="space-y-3 border-b pb-6">
                <Skeleton className="h-8 w-28 rounded-md" />
                <Skeleton className="h-3 w-44 rounded-sm" />
                <Skeleton className="h-8 w-80 max-w-full rounded-md" />
                <Skeleton className="h-4 w-[32rem] max-w-full rounded-sm" />
            </div>
            <div className="mt-5 space-y-3">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
            </div>
        </main>
    );
}

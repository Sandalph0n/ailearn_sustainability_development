export default function NavigationLoading() {
    return (
        <main
            className="mx-auto w-full max-w-7xl py-7"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="border-b pb-5">
                <div className="bg-muted h-3 w-28 animate-pulse rounded-sm" />
                <div className="bg-muted mt-3 h-7 w-64 animate-pulse rounded-sm" />
                <div className="bg-muted mt-3 h-4 w-full max-w-xl animate-pulse rounded-sm" />
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="bg-muted/70 h-40 animate-pulse rounded-lg border" />
                <div className="bg-muted/45 h-40 animate-pulse rounded-lg border" />
            </div>
            <p className="text-muted-foreground mt-4 text-sm">Loading this workspace…</p>
        </main>
    );
}

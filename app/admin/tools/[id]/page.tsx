import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowLeft02Icon, Edit02Icon } from '@hugeicons/core-free-icons';

import { ToolVersionActions } from '@/components/admin/tools/tool-version-actions';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ToolDetailPage({ params }: PageProps<'/admin/tools/[id]'>) {
    const { id } = await params;
    const tool = await db.tool.findUnique({
        where: { id },
        select: {
            id: true,
            code: true,
            name: true,
            description: true,
            codeBaseLocation: true,
            activeVersionId: true,
            versions: {
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                select: {
                    id: true,
                    version: true,
                    entryPath: true,
                    sha256: true,
                    compressedSize: true,
                    unpackedSize: true,
                    fileCount: true,
                    releaseNotes: true,
                    createdAt: true,
                    createdBy: { select: { firstName: true, lastName: true, email: true } },
                },
            },
            _count: { select: { assessments: true, workSessions: true } },
        },
    });
    if (!tool) notFound();
    const sourceUrl = safeHttpUrl(tool.codeBaseLocation);

    return (
        <div className="flex flex-col gap-7 pt-1">
            <header className="border-border flex flex-wrap items-start gap-4 border-b pb-6">
                <Link href="/admin/tools" className={buttonVariants({ variant: 'ghost', size: 'icon-sm', className: '-ml-2 mt-0.5' })} aria-label="Back to tools">
                    <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} />
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="font-heading text-2xl font-semibold tracking-tight">{tool.name}</h1>
                        <Badge variant="outline" className="font-mono">{tool.code}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{tool.description ?? 'No description provided.'}</p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/admin/tools/${id}/edit`} className={buttonVariants({ variant: 'outline' })}><HugeiconsIcon icon={Edit02Icon} strokeWidth={2} /> Edit details</Link>
                    <Link href={`/admin/tools/${id}/versions/new`} className={buttonVariants()}><HugeiconsIcon icon={Add01Icon} strokeWidth={2} /> Upload version</Link>
                </div>
            </header>

            <section className="grid gap-px overflow-hidden rounded-xl border md:grid-cols-4">
                <Fact label="Active version" value={tool.versions.find((version) => version.id === tool.activeVersionId)?.version ? `v${tool.versions.find((version) => version.id === tool.activeVersionId)?.version}` : 'Not deployed'} mono />
                <Fact label="Versions" value={String(tool.versions.length)} />
                <Fact label="Assessments" value={String(tool._count.assessments)} />
                <Fact label="Work sessions" value={String(tool._count.workSessions)} />
            </section>

            <section>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div><h2 className="font-heading text-base font-semibold">Version history</h2><p className="text-muted-foreground mt-1 text-sm">Packages are immutable. Activate a previous version without changing old sessions.</p></div>
                    {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-primary text-sm underline underline-offset-4">Source repository</a>}
                </div>
                <div className="border-border overflow-hidden rounded-xl border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Package</TableHead><TableHead>Uploaded by</TableHead><TableHead>Uploaded</TableHead><TableHead>Release notes</TableHead><TableHead className="w-44"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                        <TableBody>
                            {tool.versions.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-muted-foreground h-28 text-center">No package has been uploaded.</TableCell></TableRow>
                            ) : tool.versions.map((version) => {
                                const active = version.id === tool.activeVersionId;
                                return (
                                    <TableRow key={version.id}>
                                        <TableCell><div className="flex items-center gap-2"><span className="font-mono font-medium">v{version.version}</span>{active && <Badge>Active</Badge>}</div><span className="text-muted-foreground mt-1 block font-mono text-xs">{version.entryPath}</span></TableCell>
                                        <TableCell><span className="text-sm tabular-nums">{version.fileCount} files · {formatBytes(version.unpackedSize)}</span><span className="text-muted-foreground mt-1 block font-mono text-[11px]" title={version.sha256}>sha256 {version.sha256.slice(0, 12)}…</span></TableCell>
                                        <TableCell><span className="text-sm">{version.createdBy.firstName} {version.createdBy.lastName}</span><span className="text-muted-foreground block text-xs">{version.createdBy.email}</span></TableCell>
                                        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">{formatDate(version.createdAt)}</TableCell>
                                        <TableCell className="text-muted-foreground max-w-xs text-sm">{version.releaseNotes ?? '—'}</TableCell>
                                        <TableCell><ToolVersionActions toolId={tool.id} versionId={version.id} active={active} /></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return <div className="bg-background border-border border-r p-4 last:border-r-0"><p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p><p className={`mt-1.5 text-lg font-semibold ${mono ? 'font-mono' : 'tabular-nums'}`}>{value}</p></div>;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: Date): string {
    return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Sydney' }).format(value);
}

function safeHttpUrl(value: string | null): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
}

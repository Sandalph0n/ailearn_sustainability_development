'use client';

import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft02Icon, FileZipIcon, Upload01Icon } from '@hugeicons/core-free-icons';

import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToolSchema } from '@/lib/admin/tool-schema';
import { MAX_TOOL_PACKAGE_BYTES, MAX_TOOL_UNPACKED_BYTES } from '@/lib/tools/limits';
import { cn } from '@/lib/utils';

type ApiBody = {
    tool?: { id: string };
    error?: { message?: string; fields?: Record<string, string[]> };
};

export function ToolPackageForm({ tool }: { tool?: { id: string; code: string; name: string } }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [activate, setActivate] = useState(true);
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [codeBaseLocation, setCodeBaseLocation] = useState('');
    const [releaseNotes, setReleaseNotes] = useState('');
    const create = tool === undefined;
    const backHref = create ? '/admin/tools' : `/admin/tools/${tool.id}`;

    function acceptFile(next: File | undefined) {
        setError(undefined);
        if (next && next.size > MAX_TOOL_PACKAGE_BYTES) {
            setFile(null);
            setFieldErrors((current) => ({
                ...current,
                package: [`Package is ${formatBytes(next.size)}; direct upload supports up to ${formatBytes(MAX_TOOL_PACKAGE_BYTES)}.`],
            }));
            if (inputRef.current) inputRef.current.value = '';
            return;
        }

        setFile(next ?? null);
        setFieldErrors((current) => ({ ...current, package: [] }));
    }

    function onDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setDragging(false);
        acceptFile(event.dataTransfer.files[0]);
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(undefined);
        setFieldErrors({});

        if (!file) {
            setFieldErrors({ package: ['Choose a ZIP package'] });
            return;
        }

        let metadata: ReturnType<typeof ToolSchema.safeParse> | undefined;
        if (create) {
            metadata = ToolSchema.safeParse({ name, code, description, codeBaseLocation });
            if (!metadata.success) {
                const fields: Record<string, string[]> = {};
                for (const issue of metadata.error.issues) {
                    const key = String(issue.path[0] ?? '_form');
                    (fields[key] ??= []).push(issue.message);
                }
                setFieldErrors(fields);
                return;
            }
        }

        setSubmitting(true);
        const form = new FormData();
        form.set('package', file);
        if (create && metadata?.success) form.set('metadata', JSON.stringify(metadata.data));
        if (!create) {
            form.set('releaseNotes', releaseNotes);
            form.set('activate', String(activate));
        }

        try {
            const response = await fetch(
                create ? '/api/admin/tools' : `/api/admin/tools/${tool.id}/versions`,
                { method: 'POST', body: form },
            );
            const body: ApiBody = await response.json().catch(() => ({}));
            if (!response.ok) {
                setFieldErrors(body.error?.fields ?? {});
                setError(body.error?.message ?? 'The package could not be uploaded.');
                return;
            }

            const targetId = create ? body.tool?.id : tool.id;
            router.push(targetId ? `/admin/tools/${targetId}` : '/admin/tools');
            router.refresh();
        } catch {
            setError('Cannot reach the server. Check your connection and try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="bg-background -mx-5 min-h-[calc(100dvh-4rem)] px-5 pb-10 md:-mx-6 md:px-6">
            <form onSubmit={submit} className="mx-auto flex w-full max-w-7xl flex-col" noValidate>
                <header className="border-border flex items-start gap-4 border-b py-6">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => router.push(backHref)} disabled={submitting} aria-label="Back" className="mt-0.5 -ml-2">
                        <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} />
                    </Button>
                    <div className="min-w-0 flex-1">
                        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">{create ? 'Create tool' : 'Deploy version'}</p>
                        <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">{create ? 'New tool' : `Upload to ${tool.name}`}</h1>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{create ? 'Define the tool and publish its first immutable version.' : 'The existing versions stay unchanged and available to old sessions.'}</p>
                    </div>
                </header>

                <div className="pt-5"><FormAlert message={error} /></div>

                <div className={cn('grid items-start gap-8 py-7', create ? 'lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]' : 'lg:grid-cols-[minmax(22rem,0.8fr)_minmax(0,1fr)]')}>
                    {create && (
                        <section>
                            <SectionHeading title="Tool identity" description="Public metadata is separate from the uploaded runtime." />
                            <div className="grid gap-5 sm:grid-cols-2">
                                <TextField label="Name" value={name} onChange={setName} error={fieldErrors.name?.[0]} placeholder="Code Workspace" />
                                <TextField label="Code" value={code} onChange={setCode} error={fieldErrors.code?.[0]} placeholder="code-workspace" mono description="Permanent URL identifier." />
                                <TextField label="Description" value={description} onChange={setDescription} error={fieldErrors.description?.[0]} placeholder="What students do with it." />
                                <TextField label="Source code" value={codeBaseLocation} onChange={setCodeBaseLocation} error={fieldErrors.codeBaseLocation?.[0]} placeholder="https://github.com/…" description="Optional reference for maintainers." />
                            </div>
                        </section>
                    )}

                    {!create && (
                        <section>
                            <SectionHeading title="Release settings" description={`The manifest code must remain “${tool.code}”.`} />
                            <label className="block text-sm font-medium" htmlFor="release-notes">Release notes</label>
                            <Textarea id="release-notes" value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} maxLength={2000} placeholder="What changed in this version?" className="mt-2 min-h-32" />
                            {fieldErrors.releaseNotes?.[0] && <FieldError>{fieldErrors.releaseNotes[0]}</FieldError>}
                            <label className="border-border mt-5 flex cursor-pointer items-start gap-3 border-t pt-5 text-sm">
                                <input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} className="accent-primary mt-0.5 size-4" />
                                <span><span className="font-medium">Make active after upload</span><span className="text-muted-foreground mt-0.5 block">New assessment configurations will use this version. Existing sessions remain pinned.</span></span>
                            </label>
                        </section>
                    )}

                    <section>
                        <SectionHeading title="Runtime package" description="A self-contained browser application. Replay belongs inside this same entry and is unlocked by API capability." />
                        <div
                            onDragEnter={() => setDragging(true)}
                            onDragLeave={() => setDragging(false)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={onDrop}
                            className={cn('border-border bg-muted/20 flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors', dragging && 'border-primary bg-primary/5', fieldErrors.package?.length && 'border-destructive')}
                        >
                            <div className="bg-background border-border mb-4 grid size-11 place-items-center rounded-lg border">
                                <HugeiconsIcon icon={file ? FileZipIcon : Upload01Icon} strokeWidth={1.8} className="size-5" />
                            </div>
                            {file ? (
                                <><p className="font-medium">{file.name}</p><p className="text-muted-foreground mt-1 text-xs tabular-nums">{formatBytes(file.size)}</p></>
                            ) : (
                                <><p className="font-medium">Drop a ZIP package here</p><p className="text-muted-foreground mt-1 text-sm">or choose one from this computer</p></>
                            )}
                            <Button type="button" variant="outline" size="sm" className="mt-5" onClick={() => inputRef.current?.click()}>{file ? 'Replace package' : 'Choose package'}</Button>
                            <input ref={inputRef} type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => acceptFile(event.target.files?.[0])} />
                        </div>
                        {fieldErrors.package?.[0] && <FieldError>{fieldErrors.package[0]}</FieldError>}
                        <div className="text-muted-foreground mt-4 grid gap-1 font-mono text-xs">
                            <span>/ailearn-tool.json</span><span>/index.html</span><span>/assets/…</span>
                        </div>
                        <p className="text-muted-foreground mt-3 text-xs leading-5">
                            Manifest fields: schemaVersion, code, semantic version, protocolVersion and one HTML entry. Direct upload supports up to {formatBytes(MAX_TOOL_PACKAGE_BYTES)} compressed and {formatBytes(MAX_TOOL_UNPACKED_BYTES)} unpacked.
                        </p>
                    </section>
                </div>

                <footer className="border-border bg-background/95 sticky bottom-0 mt-auto flex justify-end gap-3 border-t py-4 backdrop-blur-sm">
                    <Button type="button" variant="outline" onClick={() => router.push(backHref)} disabled={submitting}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>{submitting && <Spinner />}{create ? 'Create and deploy' : 'Upload version'}</Button>
                </footer>
            </form>
        </section>
    );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
    return <div className="mb-5 lg:min-h-18"><h2 className="font-heading text-sm font-semibold">{title}</h2><p className="text-muted-foreground mt-1 max-w-xl text-sm leading-6">{description}</p></div>;
}

function TextField({ label, value, onChange, error, placeholder, description, mono }: { label: string; value: string; onChange: (value: string) => void; error?: string; placeholder?: string; description?: string; mono?: boolean }) {
    const id = `tool-${label.toLowerCase().replaceAll(' ', '-')}`;
    return <div><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)} className={cn('mt-2', mono && 'font-mono')} />{error && <FieldError>{error}</FieldError>}{description && <p className="text-muted-foreground mt-1.5 text-xs leading-5">{description}</p>}</div>;
}

function FieldError({ children }: { children: string }) {
    return <p className="text-destructive mt-1.5 text-xs" role="alert">{children}</p>;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

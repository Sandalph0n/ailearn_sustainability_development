import 'server-only';

import { createHash } from 'node:crypto';
import path from 'node:path';

import { fromBufferPromise, type Entry } from 'yauzl';
import { z } from 'zod';

import {
    MAX_TOOL_FILE_BYTES,
    MAX_TOOL_FILES,
    MAX_TOOL_PACKAGE_BYTES,
    MAX_TOOL_UNPACKED_BYTES,
} from './limits';

export {
    MAX_TOOL_FILE_BYTES,
    MAX_TOOL_FILES,
    MAX_TOOL_PACKAGE_BYTES,
    MAX_TOOL_UNPACKED_BYTES,
} from './limits';

export const TOOL_MANIFEST_FILE = 'tool.json';

const safePath = z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((value) => isSafeArchivePath(value), 'Must be a safe relative path');

export const ToolManifestSchema = z.strictObject({
    schemaVersion: z.literal(1),
    code: z.string().regex(/^[a-z0-9-]{2,40}$/),
    version: z
        .string()
        .max(80)
        .regex(
            /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
            'Must be a semantic version such as 1.0.0',
        ),
    entry: safePath.refine((value) => value.toLowerCase().endsWith('.html'), 'Entry must be an HTML file'),
});

export type ToolManifest = z.infer<typeof ToolManifestSchema>;

export type ToolPackageFile = {
    path: string;
    bytes: Uint8Array;
    contentType: string;
};

export type InspectedToolPackage = {
    manifest: ToolManifest;
    files: ToolPackageFile[];
    compressedSize: number;
    unpackedSize: number;
    fileCount: number;
    sha256: string;
};

export class ToolPackageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ToolPackageError';
    }
}

export async function inspectToolPackage(
    bytes: Uint8Array,
    expectedCode?: string,
): Promise<InspectedToolPackage> {
    if (bytes.byteLength === 0) throw new ToolPackageError('The package is empty');
    if (bytes.byteLength > MAX_TOOL_PACKAGE_BYTES) {
        throw new ToolPackageError('The package exceeds the 25 MB upload limit');
    }

    let zip;
    try {
        zip = await fromBufferPromise(Buffer.from(bytes), {
            lazyEntries: false,
            decodeStrings: true,
            validateEntrySizes: true,
            strictFileNames: true,
        });
    } catch {
        throw new ToolPackageError('The uploaded file is not a valid ZIP archive');
    }

    const files: ToolPackageFile[] = [];
    const names = new Set<string>();
    let unpackedSize = 0;

    try {
        for await (const entry of zip.eachEntry()) {
            if (entry.fileName.endsWith('/')) continue;
            validateEntry(entry, names);

            if (files.length >= MAX_TOOL_FILES) {
                throw new ToolPackageError(`A package may contain at most ${MAX_TOOL_FILES} files`);
            }
            if (entry.uncompressedSize > MAX_TOOL_FILE_BYTES) {
                throw new ToolPackageError(`File "${entry.fileName}" exceeds the 20 MB limit`);
            }

            unpackedSize += entry.uncompressedSize;
            if (unpackedSize > MAX_TOOL_UNPACKED_BYTES) {
                throw new ToolPackageError('The unpacked package exceeds the 100 MB limit');
            }

            const stream = await zip.openReadStreamPromise(entry);
            const chunks: Buffer[] = [];
            let actualSize = 0;
            for await (const chunk of stream) {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                actualSize += buffer.byteLength;
                if (actualSize > MAX_TOOL_FILE_BYTES) {
                    throw new ToolPackageError(`File "${entry.fileName}" exceeds the 20 MB limit`);
                }
                chunks.push(buffer);
            }

            if (actualSize !== entry.uncompressedSize) {
                throw new ToolPackageError(`File "${entry.fileName}" has an invalid size`);
            }

            files.push({
                path: entry.fileName,
                bytes: Buffer.concat(chunks),
                contentType: contentTypeFor(entry.fileName),
            });
        }
    } catch (error) {
        if (error instanceof ToolPackageError) throw error;
        throw new ToolPackageError('The ZIP archive could not be read safely');
    } finally {
        if (zip.isOpen) zip.close();
    }

    const manifestFile = files.find((file) => file.path === TOOL_MANIFEST_FILE);
    if (!manifestFile) {
        throw new ToolPackageError(`${TOOL_MANIFEST_FILE} must exist at the root of the package`);
    }

    let manifestJson: unknown;
    try {
        manifestJson = JSON.parse(Buffer.from(manifestFile.bytes).toString('utf8'));
    } catch {
        throw new ToolPackageError(`${TOOL_MANIFEST_FILE} is not valid JSON`);
    }

    const parsed = ToolManifestSchema.safeParse(manifestJson);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        const field = first?.path.join('.') || 'manifest';
        throw new ToolPackageError(`Invalid ${TOOL_MANIFEST_FILE}: ${field} ${first?.message ?? 'is invalid'}`);
    }

    if (expectedCode && parsed.data.code !== expectedCode) {
        throw new ToolPackageError(
            `Manifest code "${parsed.data.code}" does not match tool code "${expectedCode}"`,
        );
    }
    if (!names.has(parsed.data.entry.toLowerCase())) {
        throw new ToolPackageError(`Manifest entry "${parsed.data.entry}" does not exist in the package`);
    }

    return {
        manifest: parsed.data,
        files,
        compressedSize: bytes.byteLength,
        unpackedSize,
        fileCount: files.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    };
}

function validateEntry(entry: Entry, names: Set<string>): void {
    const name = entry.fileName;
    if (entry.isEncrypted()) throw new ToolPackageError('Encrypted ZIP entries are not supported');
    if (!entry.canDecodeFileData()) {
        throw new ToolPackageError(`File "${name}" uses an unsupported compression method`);
    }
    if (!isSafeArchivePath(name)) throw new ToolPackageError(`Unsafe file path "${name}"`);

    const lower = name.toLowerCase();
    if (names.has(lower)) throw new ToolPackageError(`Duplicate file path "${name}"`);
    names.add(lower);

    const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
    if (mode === 0o120000) throw new ToolPackageError(`Symbolic link "${name}" is not allowed`);

    const first = name.split('/')[0]?.toLowerCase();
    if (first === '.git' || first === 'node_modules' || first === '.env' || lower.includes('/.env')) {
        throw new ToolPackageError(`Development or secret file "${name}" is not allowed`);
    }
}

function isSafeArchivePath(value: string): boolean {
    if (!value || value.includes('\\') || value.includes('\0') || value.startsWith('/')) return false;
    if (/^[A-Za-z]:/.test(value)) return false;
    const normalized = path.posix.normalize(value);
    return normalized === value && !normalized.startsWith('../') && normalized !== '..';
}

function contentTypeFor(fileName: string): string {
    const extension = path.posix.extname(fileName).toLowerCase();
    return (
        {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.mjs': 'text/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.txt': 'text/plain; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.ico': 'image/x-icon',
            '.wasm': 'application/wasm',
            '.map': 'application/json',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
        }[extension] ?? 'application/octet-stream'
    );
}

import { describe, expect, it } from 'vitest';

import {
    inspectToolPackage,
    ToolManifestSchema,
    ToolPackageError,
} from './package';

const VALID_ZIP = Buffer.from(
    'UEsDBBQAAAAIAGayJ13CvZYoTwAAAFAAAAAJAAAAdG9vbC5qc29uNMoxCsAgDAXQu/xZRdccpHvRgIIaMGlpKb17p775PdBceewbL20yQckhS2EQjuaN1byJdDic/0AKMUQ48LR1g9Bm4StUGx3vBwAA//8DAFBLAwQUAAAACABmsiddC4180ioAAAAtAAAACgAAAGluZGV4Lmh0bWyyUUzJTy6pLEhVyCjJzbGzgZBJ+SmVdiH5+Tk2+mCmjT5YHAAAAP//AwBQSwECFAAUAAAACABmsiddwr2WKE8AAABQAAAACQAAAAAAAAAAAAAAAAAAAAAAdG9vbC5qc29uUEsBAhQAFAAAAAgAZrInXQuNfNIqAAAALQAAAAoAAAAAAAAAAAAAAAAAdgAAAGluZGV4Lmh0bWxQSwUGAAAAAAIAAgBvAAAAyAAAAAAA',
    'base64',
);

describe('tool package contract', () => {
    it('reads one entry and immutable version metadata from a valid package', async () => {
        const result = await inspectToolPackage(VALID_ZIP, 'ui-test-tool');

        expect(result.manifest).toEqual({
            schemaVersion: 1,
            code: 'ui-test-tool',
            version: '1.0.0',
            entry: 'index.html',
        });
        expect(result.files.map((file) => file.path)).toEqual([
            'tool.json',
            'index.html',
        ]);
        expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rejects a package intended for another tool', async () => {
        await expect(inspectToolPackage(VALID_ZIP, 'diagram')).rejects.toThrow(
            'does not match tool code',
        );
    });

    it('rejects an invalid archive without leaking parser details', async () => {
        await expect(inspectToolPackage(Buffer.from('not a zip'))).rejects.toBeInstanceOf(
            ToolPackageError,
        );
    });

    it('does not accept a second replay entry in the manifest', () => {
        expect(
            ToolManifestSchema.safeParse({
                schemaVersion: 1,
                code: 'code-editor',
                version: '1.0.0',
                entry: 'index.html',
                replayEntry: 'replay.html',
            }).success,
        ).toBe(false);
    });
});

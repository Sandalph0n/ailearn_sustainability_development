import { describe, expect, it } from 'vitest';

import {
    inspectToolPackage,
    ToolManifestSchema,
    ToolPackageError,
} from './package';

const VALID_ZIP = Buffer.from(
    'UEsDBBQAAAAIADaqJ132NUmCVAAAAGcAAAARAAAAYWlsZWFybi10b29sLmpzb249yzEOgCAMBdDdY/y5EFg5iLuBJpIANVCNxnh3J93fuzHiynWZuY8sDcEToiRGwJ6N8lCjIgWE4xPw1lkHwtZFJUr5LzwI3LRfCMgt8WlXrQXP9AJQSwMEFAAAAAgANqonXZo+9glyAAAAkgAAAAoAAABpbmRleC5odG1sJY5BDsMgDATvfYXLvUK99eD4Ff2AC05AARwFN1J+XzVc9jA7Ky3eowY7N4FktRD+Ewq3ZXLSHGESjoRVjCEk3rvY5L42P16O0LIVobdqgY3DyouASTf0o0A/xh+NJ2Hl3IZ7yN6zNniivyD6Yfjrwe0HUEsBAhQAFAAAAAgANqonXfY1SYJUAAAAZwAAABEAAAAAAAAAAAAAAAAAAAAAAGFpbGVhcm4tdG9vbC5qc29uUEsBAhQAFAAAAAgANqonXZo+9glyAAAAkgAAAAoAAAAAAAAAAAAAAAAAgwAAAGluZGV4Lmh0bWxQSwUGAAAAAAIAAgB3AAAAHQEAAAAA',
    'base64',
);

describe('tool package contract', () => {
    it('reads one entry and immutable version metadata from a valid package', async () => {
        const result = await inspectToolPackage(VALID_ZIP, 'ui-test-tool');

        expect(result.manifest).toEqual({
            schemaVersion: 1,
            code: 'ui-test-tool',
            version: '1.0.0',
            protocolVersion: '1',
            entry: 'index.html',
        });
        expect(result.files.map((file) => file.path)).toEqual([
            'ailearn-tool.json',
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
                protocolVersion: '1',
                entry: 'index.html',
                replayEntry: 'replay.html',
            }).success,
        ).toBe(false);
    });
});

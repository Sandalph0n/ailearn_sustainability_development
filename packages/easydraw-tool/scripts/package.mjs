import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(packageRoot, 'dist');
const artifactRoot = path.join(packageRoot, 'artifacts');

async function collect(directory, prefix = '') {
    const result = {};
    for (const name of await readdir(directory)) {
        const absolute = path.join(directory, name);
        const relative = path.posix.join(prefix, name);
        const info = await stat(absolute);
        if (info.isDirectory()) Object.assign(result, await collect(absolute, relative));
        else result[relative] = new Uint8Array(await readFile(absolute));
    }
    return result;
}

const files = await collect(distRoot);
if (!files['tool.json'] || !files['index.html']) {
    throw new Error('Build output must contain tool.json and index.html at its root');
}
const manifest = JSON.parse(new TextDecoder().decode(files['tool.json']));
if (typeof manifest.version !== 'string' || !manifest.version) {
    throw new Error('tool.json must contain a version');
}

await mkdir(artifactRoot, { recursive: true });
const output = path.join(artifactRoot, `easydraw-${manifest.version}.zip`);
const zip = zipSync(files, { level: 9 });
await writeFile(output, zip);

const unpacked = Object.values(files).reduce((total, bytes) => total + bytes.byteLength, 0);
console.log(JSON.stringify({ output, files: Object.keys(files).length, compressed: zip.byteLength, unpacked }, null, 2));

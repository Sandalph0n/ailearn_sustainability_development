import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * EasyDraw as a Lernumi tool.
 *
 * Lernumi serves every uploaded tool version from its own sub-path on an isolated
 * origin (`/tools/easydraw/<versionId>/…`), so the bundle must use relative URLs
 * and ship as one `index.html` — hence `base: './'` and a single entry.
 *
 * `editor/` is the upstream easydraw editor (`client/src/lib` + its two
 * stylesheets) copied verbatim; it keeps importing `@/lib/...`, so `@` points at
 * that folder. Its only Next.js touch-points, `next/link` and `next/navigation`,
 * resolve to shims that drive the in-app screen state instead.
 */
const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.join(packageRoot, 'editor'),
            'next/link': path.join(packageRoot, 'src/shims/next-link.tsx'),
            'next/navigation': path.join(packageRoot, 'src/shims/next-navigation.ts'),
        },
    },
    build: {
        target: 'es2022',
        sourcemap: false,
        rollupOptions: {
            onwarn(warning, warn) {
                // The upstream editor carries Next's "use client" markers; harmless here.
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
                warn(warning);
            },
        },
    },
    server: {
        port: 5174,
    },
});

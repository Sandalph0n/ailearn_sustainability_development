import { defineConfig } from 'vitest/config';

export default defineConfig({
    base: './',
    build: {
        target: 'es2022',
        sourcemap: false,
        reportCompressedSize: true,
        // VS Code theme files can include other theme assets. Emitting every asset as a
        // real file keeps those nested reads on HTTP(S); data URLs are not reliable when
        // the host browser or an extension wraps fetch().
        assetsInlineLimit: 0,
    },
    worker: {
        format: 'es',
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});

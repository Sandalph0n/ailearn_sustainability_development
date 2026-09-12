import { defineConfig } from 'vitest/config';

export default defineConfig({
    base: './',
    build: {
        target: 'es2022',
        sourcemap: false,
        reportCompressedSize: true,
    },
    worker: {
        format: 'es',
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});

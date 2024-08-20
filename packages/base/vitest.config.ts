import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['./tests/**'],
        exclude: ['./tests/coverage/**', './tests/fixtures/**'],
        environment: 'jsdom',
        setupFiles: ['../tests/jestSetup.js'],
    }
});

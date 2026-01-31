import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

export default defineConfig({
    sourceLocale: 'ko',
    locales: ['ko', 'en'],
    catalogs: [
        {
            path: 'src/locales/{locale}/messages',
            include: ['src/', 'app/'],
            exclude: ['**/*.d.ts', '**/node_modules/**'],
        },
    ],
    format: formatter({ lineNumbers: false }),
});

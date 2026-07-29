import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// Defaults for local dev — CI overrides these via workflow env vars.
process.env.DATABASE_URL ??= 'postgresql://myuser:password@localhost:5432/assistant_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
// Never actually called in tests (chat.ts's Groq calls are swapped for a
// FakeAssistantProvider), but config.ts requires it to be set to boot.
process.env.GROQ_API_KEY ??= 'test-key';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
      },
    }),
  ],
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    setupFiles: ['reflect-metadata'],
    globalSetup: ['./tests/helpers/globalSetup.ts'],
    pool: 'forks',
    // Every e2e file shares one physical database, and truncateAll() blanket-clears all
    // tables per file, not just the ones that file uses — running files concurrently means
    // one file's cleanup can wipe rows another file just seeded mid-test. Simpler and more
    // robust to just not run them at the same time than to make truncation surgically
    // scoped per file (fragile — breaks again the next time a file forgets the constraint).
    fileParallelism: false,
  },
});

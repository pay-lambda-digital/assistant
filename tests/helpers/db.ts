import { Client } from 'pg';
import { db, connectDb } from '../../src/db';

function parseDbUrl(): { adminUrl: string; dbName: string } {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.slice(1);
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';
  return { adminUrl: admin.toString(), dbName };
}

// Schema creation happens once in tests/helpers/globalSetup.ts (see that file for why —
// short version: doing it here, per test file, races under `pool: 'forks'`). This just
// connects this test file's own db singleton — each forked worker is a separate process.
export async function ensureDb(): Promise<void> {
  if (!db.isInitialized) {
    await connectDb();
  }
}

export async function truncateAll(): Promise<void> {
  await db.query(`
    TRUNCATE TABLE
      assistant_answer_cache,
      assistant_messages,
      assistant_conversations,
      assistant_user_memories,
      structured_facts,
      doc_chunks
    RESTART IDENTITY CASCADE
  `);
}

export async function dropDb(): Promise<void> {
  if (db.isInitialized) await db.destroy();

  const { adminUrl, dbName } = parseDbUrl();
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  await client.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName],
  );
  await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await client.end();
}

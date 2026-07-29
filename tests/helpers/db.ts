import { Client } from 'pg';
import { db, connectDb } from '../../src/db';

function parseDbUrl(): { adminUrl: string; dbName: string } {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.slice(1);
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';
  return { adminUrl: admin.toString(), dbName };
}

// `assistant` doesn't own migrations — `app` does (see app/db/migrations). This mirrors
// the DDL from 1720000000016-CreateAssistantTables.js and
// 1720000000017-CreateAssistantAnswerCache.js for just what assistant needs, with the
// `REFERENCES users(id)` FKs dropped since this test DB doesn't have app's `users` table.
// Keep in sync with those migrations if the schema changes.
export async function ensureDb(): Promise<void> {
  const { adminUrl, dbName } = parseDbUrl();
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    // 42P04 = duplicate_database — another test run created it first, fine
    if ((err as { code?: string }).code !== '42P04') throw err;
  }
  await client.end();

  if (!db.isInitialized) {
    await connectDb();
  }

  await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await db.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS doc_chunks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "sourceFile" VARCHAR NOT NULL,
      heading VARCHAR,
      content TEXT NOT NULL,
      embedding VECTOR(384) NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx ON doc_chunks
    USING hnsw (embedding vector_cosine_ops)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS structured_facts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      key VARCHAR NOT NULL UNIQUE,
      data JSONB NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS assistant_conversations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "userId" UUID,
      "sessionId" VARCHAR,
      "createdAt" TIMESTAMP NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS assistant_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "conversationId" UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
      role VARCHAR NOT NULL,
      content TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS assistant_user_memories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "userId" UUID NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS assistant_answer_cache (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      question TEXT NOT NULL,
      embedding VECTOR(384) NOT NULL,
      answer TEXT NOT NULL,
      "hitCount" INT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS assistant_answer_cache_embedding_idx ON assistant_answer_cache
    USING hnsw (embedding vector_cosine_ops)
  `);
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

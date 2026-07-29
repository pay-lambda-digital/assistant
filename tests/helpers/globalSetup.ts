import { Client } from 'pg';

function parseDbUrl(): { adminUrl: string; dbName: string } {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.slice(1);
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';
  return { adminUrl: admin.toString(), dbName };
}

// Runs once, in a single process, before any test file's worker starts — this is what
// makes schema creation race-free. With `pool: 'forks'`, each test file runs in its own
// process; if schema creation lived in each file's own beforeAll instead, concurrent
// `CREATE TABLE IF NOT EXISTS` calls could race on the table's implicit row type in
// pg_type (IF NOT EXISTS' check-then-create isn't atomic under concurrency). Test files'
// own beforeAll (see ensureDb in tests/helpers/db.ts) only connects, never creates.
//
// `assistant` doesn't own migrations (app does) — this mirrors the DDL from
// app/db/migrations/1720000000016-CreateAssistantTables.js and
// .../1720000000017-CreateAssistantAnswerCache.js for just what assistant needs, with
// `REFERENCES users(id)` FKs dropped since this test DB doesn't have app's users table.
// Keep in sync with those migrations if the schema changes.
export default async function setup(): Promise<void> {
  const { adminUrl, dbName } = parseDbUrl();
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    if ((err as { code?: string }).code !== '42P04') throw err;
  }
  await admin.end();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS doc_chunks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "sourceFile" VARCHAR NOT NULL,
      heading VARCHAR,
      content TEXT NOT NULL,
      embedding VECTOR(384) NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx ON doc_chunks
    USING hnsw (embedding vector_cosine_ops)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS structured_facts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      key VARCHAR NOT NULL UNIQUE,
      data JSONB NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS assistant_conversations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "userId" UUID,
      "sessionId" VARCHAR,
      "createdAt" TIMESTAMP NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS assistant_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "conversationId" UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
      role VARCHAR NOT NULL,
      content TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS assistant_user_memories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "userId" UUID NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS assistant_answer_cache (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      question TEXT NOT NULL,
      embedding VECTOR(384) NOT NULL,
      answer TEXT NOT NULL,
      "hitCount" INT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS assistant_answer_cache_embedding_idx ON assistant_answer_cache
    USING hnsw (embedding vector_cosine_ops)
  `);

  await client.end();
}

import { AssistantAnswerCache } from '@pay-lambda-digital/entities';
import { db } from './db';
import { embed } from './embed';

// Cosine distance — lower is more similar. Tune after real traffic; start conservative
// (only near-duplicate phrasing hits) rather than risk a wrong-but-plausible cached answer.
const SIMILARITY_THRESHOLD = 0.08;

interface CachedAnswer {
  id: string;
  answer: string;
}

interface CacheRow {
  id: string;
  answer: string;
  distance: string;
}

// Only meaningful for fresh, context-free questions — see routes/chat.ts, which skips
// this entirely once a session has prior history.
export async function findCachedAnswer(question: string): Promise<CachedAnswer | null> {
  const embedding = await embed(question);
  const vectorLiteral = `[${embedding.join(',')}]`;

  const rows: CacheRow[] = await db.query(
    `SELECT id, answer, embedding <=> $1 AS distance
     FROM assistant_answer_cache
     ORDER BY embedding <=> $1
     LIMIT 1`,
    [vectorLiteral],
  );

  const [top] = rows;
  if (!top || Number(top.distance) > SIMILARITY_THRESHOLD) return null;

  await db.getRepository(AssistantAnswerCache).increment({ id: top.id }, 'hitCount', 1);
  return { id: top.id, answer: top.answer };
}

export async function cacheAnswer(question: string, answer: string): Promise<void> {
  const embedding = await embed(question);
  const repo = db.getRepository(AssistantAnswerCache);
  await repo.save(repo.create({ question, embedding, answer, hitCount: 0 }));
}

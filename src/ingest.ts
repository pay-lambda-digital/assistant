import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import { DocChunk, StructuredFact, AssistantAnswerCache } from '@pay-lambda-digital/entities';
import { connectDb, db } from './db';
import { embed } from './embed';
import { plans } from '../content/pricing';
import { chains } from '../content/chains';

const MAX_WORDS_PER_CHUNK = 400; // ~500 tokens, rough word-based approximation
const OVERLAP_WORDS = 50;

interface Chunk {
  heading: string | null;
  content: string;
}

// Splits on level-2 headings first (each section = one topic), then further splits any
// section that's still too long, with a word-overlap so a fact split across the boundary
// isn't lost to either chunk.
function chunkMarkdown(markdown: string): Chunk[] {
  const sections = markdown.split(/\n(?=## )/g);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^##\s+(.+)/);
    const heading = headingMatch ? headingMatch[1].trim() : null;
    const words = trimmed.split(/\s+/);

    if (words.length <= MAX_WORDS_PER_CHUNK) {
      chunks.push({ heading, content: trimmed });
      continue;
    }

    const step = MAX_WORDS_PER_CHUNK - OVERLAP_WORDS;
    for (let i = 0; i < words.length; i += step) {
      chunks.push({ heading, content: words.slice(i, i + MAX_WORDS_PER_CHUNK).join(' ') });
      if (i + MAX_WORDS_PER_CHUNK >= words.length) break;
    }
  }

  return chunks;
}

async function ingestKb(): Promise<void> {
  const kbDir = path.join(process.cwd(), 'content', 'kb');
  const files = fs.readdirSync(kbDir).filter((f) => f.endsWith('.md'));
  const chunkRepo = db.getRepository(DocChunk);

  // Full re-ingest each run — the KB is a few dozen chunks, so "clear and rewrite" is the
  // simplest correct model rather than diffing against what's already there.
  await chunkRepo.clear();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(kbDir, file), 'utf-8');
    const chunks = chunkMarkdown(raw);

    for (const chunk of chunks) {
      const embedding = await embed(chunk.content);
      await chunkRepo.save(
        chunkRepo.create({
          sourceFile: file,
          heading: chunk.heading,
          content: chunk.content,
          embedding,
        }),
      );
    }
    console.log(`[ingest] ${file}: ${chunks.length} chunks`);
  }
}

async function ingestStructuredFacts(): Promise<void> {
  const factRepo = db.getRepository(StructuredFact);

  const upsert = async (key: string, data: Record<string, unknown>): Promise<void> => {
    const existing = await factRepo.findOneBy({ key });
    if (existing) {
      await factRepo.update(existing.id, { data });
    } else {
      await factRepo.save(factRepo.create({ key, data }));
    }
  };

  await upsert('pricing', { plans });
  await upsert('chains', { chains });
  console.log('[ingest] structured facts updated: pricing, chains');
}

async function invalidateAnswerCache(): Promise<void> {
  // Content just changed (or this is a routine redeploy re-ingest either way) — any
  // cached answer could now be stale, so drop them all rather than track staleness per
  // entry. Cheap: the cache repopulates itself from real traffic.
  await db.getRepository(AssistantAnswerCache).clear();
  console.log('[ingest] answer cache cleared');
}

async function main(): Promise<void> {
  await connectDb();
  await ingestKb();
  await ingestStructuredFacts();
  await invalidateAnswerCache();
  await db.destroy();
  console.log('[ingest] done');
}

main().catch((err) => {
  console.error('[ingest] failed:', err);
  process.exit(1);
});

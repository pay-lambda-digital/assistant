// Deliberately dependency-free (no db/config/env imports) — this is the pure-logic half
// of ingestion, kept separate from ingest.ts's orchestration so it stays unit-testable
// without an environment. See tests/unit/chunkMarkdown.test.ts.

const MAX_WORDS_PER_CHUNK = 400; // ~500 tokens, rough word-based approximation
const OVERLAP_WORDS = 50;

export interface Chunk {
  heading: string | undefined;
  content: string;
}

// Splits on level-2 headings first (each section = one topic), then further splits any
// section that's still too long, with a word-overlap so a fact split across the boundary
// isn't lost to either chunk.
export function chunkMarkdown(markdown: string): Chunk[] {
  const sections = markdown.split(/\n(?=## )/g);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^##\s+(.+)/);
    const heading = headingMatch ? headingMatch[1].trim() : undefined;
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

import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from '../../src/chunk';

describe('chunkMarkdown', () => {
  it('keeps a short single-section document as one chunk', () => {
    const chunks = chunkMarkdown('# Title\n\nJust a short intro paragraph.');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBeUndefined();
    expect(chunks[0].content).toContain('Just a short intro paragraph.');
  });

  it('splits on level-2 headings into separate chunks', () => {
    const md = '# Title\n\nIntro.\n\n## First\n\nFirst body.\n\n## Second\n\nSecond body.';

    const chunks = chunkMarkdown(md);

    expect(chunks.map((c) => c.heading)).toEqual([undefined, 'First', 'Second']);
  });

  it('splits an oversized section into overlapping chunks under the same heading', () => {
    const words = Array.from({ length: 900 }, (_, i) => `word${i}`).join(' ');
    const md = `## Big Section\n\n${words}`;

    const chunks = chunkMarkdown(md);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.heading === 'Big Section')).toBe(true);

    // The tail of one chunk should reappear at the head of the next — that's the overlap.
    const lastWordOfFirstChunk = chunks[0].content.split(' ').pop();
    expect(chunks[1].content).toContain(lastWordOfFirstChunk!);
  });

  it('skips a genuinely empty leading section (no title, no content, before the first heading)', () => {
    const md = '\n\n## Real\n\nContent here.';

    const chunks = chunkMarkdown(md);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading).toBe('Real');
  });
});

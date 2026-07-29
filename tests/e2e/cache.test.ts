import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../../src/db';
import { findCachedAnswer, cacheAnswer } from '../../src/cache';
import { ensureDb, truncateAll } from '../helpers/db';

describe('answer cache', () => {
  beforeAll(async () => {
    await ensureDb();
  }, 30_000);

  beforeEach(async () => {
    await truncateAll();
  });

  it('hits on a near-duplicate phrasing of a cached question', async () => {
    await cacheAnswer('How much does the Auto-convert plan cost?', 'It costs 0.1% per payment.');

    const hit = await findCachedAnswer('What is the price of the Auto-convert plan?');

    expect(hit).not.toBeNull();
    expect(hit?.answer).toBe('It costs 0.1% per payment.');
  }, 20_000);

  it('misses on an unrelated question', async () => {
    await cacheAnswer('How much does the Auto-convert plan cost?', 'It costs 0.1% per payment.');

    const hit = await findCachedAnswer('What is your name?');

    expect(hit).toBeNull();
  }, 20_000);

  it('increments hitCount on a hit', async () => {
    // Identical text — a guaranteed hit regardless of threshold tuning. This test is about
    // the increment mechanism, not similarity matching (the first test already covers that).
    const question = 'How much does the Auto-convert plan cost?';
    await cacheAnswer(question, 'It costs 0.1% per payment.');
    await findCachedAnswer(question);

    const rows: { hitCount: number }[] = await db.query(
      `SELECT "hitCount" FROM assistant_answer_cache`,
    );

    expect(rows[0].hitCount).toBe(1);
  }, 20_000);
});

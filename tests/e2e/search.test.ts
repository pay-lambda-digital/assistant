import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DocChunk } from '@pay-lambda-digital/entities';
import { db } from '../../src/db';
import { embed } from '../../src/embed';
import { searchDocs } from '../../src/search';
import { ensureDb, truncateAll } from '../helpers/db';

describe('searchDocs', () => {
  beforeAll(async () => {
    await ensureDb();
  }, 30_000);

  beforeEach(async () => {
    await truncateAll();
  });

  it('ranks the semantically closer chunk first', async () => {
    const repo = db.getRepository(DocChunk);
    const webhookText =
      'Webhooks deliver real-time payment notifications signed with HMAC-SHA256.';
    const chainsText =
      'Supported chains are BSC, Ethereum, Tron, TON, Polygon, and Arbitrum.';

    await repo.save(
      repo.create({
        sourceFile: 'webhooks.md',
        heading: 'Webhooks',
        content: webhookText,
        embedding: await embed(webhookText),
      }),
    );
    await repo.save(
      repo.create({
        sourceFile: 'chains.md',
        heading: 'Chains',
        content: chainsText,
        embedding: await embed(chainsText),
      }),
    );

    const results = await searchDocs('how do I verify a webhook signature', 5);

    expect(results[0].heading).toBe('Webhooks');
  }, 20_000);

  it('returns an empty array when there are no chunks to match', async () => {
    const results = await searchDocs('anything', 5);

    expect(results).toEqual([]);
  }, 20_000);
});

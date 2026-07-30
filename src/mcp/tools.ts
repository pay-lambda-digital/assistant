import { StructuredFact } from '@pay-lambda-digital/entities';
import { db } from '../db';
import { searchDocs } from '../search';
import type { ToolDefinition, ToolCall } from '../llm/types';

// Plain in-process tool registry for v1 — same name/description/JSON-schema shape real
// MCP tools use, so promoting this to an actual @modelcontextprotocol/sdk server + public
// transport later (see "MCP" in ASSISTANT_PLAN.md) only wraps these handlers in a
// transport layer, it doesn't rewrite the tool logic itself.

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'search_docs',
    description: 'Search Lambda Digital product documentation for relevant passages.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the visitor is asking about' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_pricing',
    description: 'Get the current plan tiers and fees.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_supported_chains',
    description: 'Get the list of supported blockchains, tokens, and confirmation requirements.',
    parameters: { type: 'object', properties: {} },
  },
];

async function getStructuredFact(key: string): Promise<unknown> {
  const fact = await db.getRepository(StructuredFact).findOneBy({ key });
  if (!fact) throw new Error(`StructuredFact "${key}" not ingested yet — run "npm run ingest"`);
  return fact.data;
}

// pgvector's `<=>` always returns the k-nearest rows, even when none of them are
// actually relevant (e.g. "what is your name" still returns *something*). Without a
// cutoff, the model gets handed unrelated chunks framed as if they were relevant context
// — cut them here so an honest "nothing found" signal reaches the model instead.
//
// 0.25 was an untested guess and was rejecting genuinely correct matches: querying
// "webhooks" against the real KB returns webhooks.md's own intro chunk at 0.382 as the
// top hit (see [search_docs] debug logging) — all-MiniLM-L6-v2 cosine distances for
// short queries against markdown passages just run higher than that. Recalibrated to
// 0.6 from that real sample; re-check with an off-topic query (e.g. "capital of France")
// to confirm it still rejects genuinely unrelated content before removing this comment.
const SEARCH_RELEVANCE_THRESHOLD = 0.6;

export async function runTool(call: ToolCall): Promise<string> {
  switch (call.name) {
    case 'search_docs': {
      const query = String(call.arguments.query ?? '');
      const all = await searchDocs(query, 5);
      const results = all.filter((r) => r.distance <= SEARCH_RELEVANCE_THRESHOLD);
      if (results.length === 0) {
        return JSON.stringify({ found: false, message: 'No relevant documentation found for this query.' });
      }
      return JSON.stringify(results.map((r) => ({ heading: r.heading, content: r.content })));
    }
    case 'get_pricing':
      return JSON.stringify(await getStructuredFact('pricing'));
    case 'get_supported_chains':
      return JSON.stringify(await getStructuredFact('chains'));
    default:
      return JSON.stringify({ error: `Unknown tool: ${call.name}` });
  }
}

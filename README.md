# assistant

RAG chat service behind Lambda Digital's "Any questions?" widget. Runs as its own
container so a crash or slow response here can't affect the main app.

MCP tools (`search_docs`, `get_pricing`, `get_supported_chains`) over a pgvector-backed
knowledge base, served through an LLM provider (Groq by default — see `src/llm/index.ts`;
implement `AssistantProvider` from `src/llm/types.ts` to add another).

## Local development

```
cp .env.example .env   # fill in DATABASE_URL / REDIS_URL / GROQ_API_KEY
npm install
npm run ingest:dev     # embed content/ into Postgres (pgvector)
npm run dev
```

## Environment

See `.env.example` for the full list. Notable ones:

- `LLM_PROVIDER` — selects the provider from `src/llm/index.ts`'s registry (`groq` today).
- `GROQ_MODEL` — defaults to `openai/gpt-oss-20b`, not a Llama model. Llama 3.3 70B on Groq
  has a well-documented, ongoing issue emitting malformed tool-call generations; gpt-oss is
  OpenAI's own open-weight model, trained on the tool-call format Groq's API validates
  against, and is far more reliable here. If you change this, retest tool-calling
  thoroughly.

## Adding another LLM provider

`chat.ts` never talks to an LLM SDK directly — it calls `activeProvider.chat(...)` from
`src/llm/index.ts`, which selects an `AssistantProvider` (`src/llm/types.ts`) by
`LLM_PROVIDER`. To add one:

1. Create `src/llm/<name>.ts` exporting an object that implements `AssistantProvider`:
   an async generator `chat({ messages, tools, onToolCall })` that yields the answer as it
   becomes available, calling `onToolCall` for each tool call the model makes. Model the
   shape on `src/llm/groq.ts`, but don't copy its retry/temperature workarounds
   wholesale — those exist for specific, observed Groq-hosted-model quirks (malformed
   tool-call generations, a Harmony-format leak from gpt-oss). A different provider likely
   doesn't need them; add error handling for whatever you actually observe breaking, not
   preemptively.
2. Add config for it in `config.ts` (API key via `required(...)`, model name, etc.) and to
   `.env.example`.
3. Register it in `src/llm/index.ts`'s `providers` map: `<name>: <name>Provider`.
4. Set `LLM_PROVIDER=<name>` in `.env`.

Nothing else changes — `chat.ts`, the route, the tools, and the frontend are all
provider-agnostic.

## Content

`content/kb/*.md` and `content/{pricing,chains}.ts` are curated by hand here and kept in
sync manually with the main site — update both places when pricing or supported chains
change. **Always run `npm run ingest:dev` (or redeploy) after editing anything under
`content/`** — it re-embeds the KB and clears the answer cache; without it you'll be
testing against stale data.

Retrieval quality depends on chunk granularity: `chunkMarkdown` (`src/chunk.ts`) only
splits on `##` headings, so a file with no `##` headings (or one broad heading covering
several unrelated topics) becomes a single chunk — its embedding gets diluted across every
topic in it and won't rank well for any one of them. Give each distinct topic/question its
own `##` heading (see `faq.md`); it's fine for a genuinely single-topic doc (like
`security.md`) to stay as one chunk.

- [Quick Start](content/kb/quickstart.md)
- [Webhooks](content/kb/webhooks.md)
- [Security](content/kb/security.md)
- [Subscription Billing](content/kb/subscription-billing.md)
- [FAQ](content/kb/faq.md)
- [Legal & Compliance Policies](content/kb/legal-policies.md)

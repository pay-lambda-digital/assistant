# assistant

RAG chat service behind Lambda Digital's "Any questions?" widget. Runs as its own
container so a crash or slow response here can't affect the main app.

MCP tools (`search_docs`, `get_pricing`, `get_supported_chains`) over a pgvector-backed
knowledge base, served through Groq for chat completion.

## Local development

```
cp .env.example .env   # fill in DATABASE_URL / REDIS_URL / GROQ_API_KEY
npm install
npm run ingest:dev     # embed content/ into Postgres
npm run dev
```

Requires a Postgres with the `vector` extension (see the `pgvector/pgvector:pg16` image
used in production) and Redis, both reachable at the URLs in `.env`.

## Content

`content/kb/*.md` and `content/{pricing,chains}.ts` are curated by hand here and kept in
sync manually with the main site — update both places when pricing or supported chains
change.

- [Quick Start](content/kb/quickstart.md)
- [Webhooks](content/kb/webhooks.md)
- [Security](content/kb/security.md)
- [Subscription Billing](content/kb/subscription-billing.md)
- [FAQ](content/kb/faq.md)

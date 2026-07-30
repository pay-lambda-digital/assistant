import 'reflect-metadata';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { config } from './config';
import { connectDb } from './db';
import { chatRoute } from './routes/chat';

async function main(): Promise<void> {
  await connectDb();

  const fastify = Fastify({ logger: true });
  await fastify.register(cookie);
  if (process.env.NODE_ENV !== 'production') {
    // In production this is same-origin, routed by nginx (see ASSISTANT_PLAN.md) — no
    // CORS needed there. Locally the browser hits this service directly cross-origin, and
    // the session cookie requires an explicit origin + credentials, not a wildcard.
    await fastify.register(cors, {
      origin: 'http://localhost:3000',
      credentials: true,
    });
  }
  await fastify.register(chatRoute);

  fastify.get('/health', async () => ({ status: 'ok' }));

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`[assistant] listening on :${config.port}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});

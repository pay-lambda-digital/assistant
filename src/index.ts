import 'reflect-metadata';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { config } from './config';
import { connectDb } from './db';
import { chatRoute } from './routes/chat';

async function main(): Promise<void> {
  await connectDb();

  const fastify = Fastify({ logger: true });
  await fastify.register(cookie);
  await fastify.register(chatRoute);

  fastify.get('/health', async () => ({ status: 'ok' }));

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`[assistant] listening on :${config.port}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});

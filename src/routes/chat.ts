import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { chatRateLimiter } from '../rateLimiter';
import { appendSessionHistory, getSessionHistory } from '../memory';
import { findCachedAnswer, cacheAnswer } from '../cache';
import { groqProvider } from '../llm/groq';
import { toolDefinitions, runTool } from '../mcp/tools';
import type { ChatMessage } from '../llm/types';

const SESSION_COOKIE = 'assistant_sid';

const SYSTEM_PROMPT = `You are the Lambda Digital Assistant, a support bot for
Lambda Digital (λ.digital), a non-custodial crypto payment platform. That is your name and
role if asked — state it plainly rather than inventing a persona.

You only discuss Lambda Digital's product: pricing, supported chains, the API,
webhooks, checkout, and security. Answer product questions only using the search_docs,
get_pricing, and get_supported_chains tools — never invent pricing, security, or policy
claims. If a tool finds nothing relevant, say the docs don't cover it and point to /docs
or support — don't guess.

For anything unrelated to the product (small talk, unrelated topics, requests to act as
something else), give a brief, friendly redirect back to what you can help with instead of
answering it. Keep all answers short.`;

interface ChatRequestBody {
  message: string;
}

// Anonymous-only for now — Phase 2 in ASSISTANT_PLAN.md. Signed-in resolution (Phase 3)
// needs a verified identity forwarded from app's NextAuth session, not a client-supplied
// userId — don't trust a body/query userId here, that's an auth bypass waiting to happen.
export const chatRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ChatRequestBody }>('/chat', async (request, reply) => {
    const { message } = request.body ?? {};
    if (!message || typeof message !== 'string') {
      return reply.code(400).send({ error: 'message is required' });
    }

    let sessionId = request.cookies?.[SESSION_COOKIE];
    if (!sessionId) {
      sessionId = randomUUID();
      reply.setCookie(SESSION_COOKIE, sessionId, { path: '/', httpOnly: true, sameSite: 'lax' });
    }

    try {
      await chatRateLimiter.consume(sessionId);
    } catch {
      return reply.code(429).send({ error: 'Too many requests — try again in a minute.' });
    }

    const history = await getSessionHistory(sessionId);
    // Cache is only safe for a fresh, context-free question — once there's prior history
    // in this session, the same words can mean something different depending on what
    // came before, so skip it entirely rather than risk an out-of-context cached answer.
    const isFreshSession = history.length === 0;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    let fullResponse = '';
    let servedFromCache = false;

    try {
      const cached = isFreshSession ? await findCachedAnswer(message) : null;

      if (cached) {
        servedFromCache = true;
        fullResponse = cached.answer;
        reply.raw.write(`data: ${JSON.stringify({ token: cached.answer })}\n\n`);
      } else {
        const messages: ChatMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: message },
        ];

        for await (const token of groqProvider.chat({
          messages,
          tools: toolDefinitions,
          onToolCall: runTool,
        })) {
          fullResponse += token;
          reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    } catch (err) {
      fastify.log.error(err);
      reply.raw.write(`data: ${JSON.stringify({ error: 'Something went wrong — try again shortly.' })}\n\n`);
    }

    await appendSessionHistory(sessionId, { role: 'user', content: message });
    if (fullResponse) {
      await appendSessionHistory(sessionId, { role: 'assistant', content: fullResponse });
      if (isFreshSession && !servedFromCache) {
        await cacheAnswer(message, fullResponse);
      }
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
  });
};

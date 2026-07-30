import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { chatRateLimiter } from '../rateLimiter';
import { appendSessionHistory, getSessionHistory } from '../memory';
import { findCachedAnswer, cacheAnswer } from '../cache';
import { activeProvider } from '../llm';
import { toolDefinitions, runTool } from '../mcp/tools';
import type { ChatMessage } from '../llm/types';

const SESSION_COOKIE = 'assistant_sid';

const SYSTEM_PROMPT = `You are the Lambda Digital Assistant, a support bot for
Lambda Digital (λ.digital), a non-custodial crypto payment platform. That is your name and
role if asked — state it plainly rather than inventing a persona.

You only discuss Lambda Digital's product: pricing, supported chains, the API,
webhooks, checkout, and security. Answer product questions only using the search_docs,
get_pricing, and get_supported_chains tools — never invent ANY product fact not returned
by a tool. This includes pricing, security, policy, refunds, and contact details (support
email, phone, links) — if a tool didn't give it to you, you don't know it, full stop; don't
fill the gap with something plausible-sounding. This "don't invent, use tools" rule is
about product facts specifically — it doesn't apply to the conversation itself. If the
visitor told you something earlier (their name, a preference, something they're building),
just use it naturally; you don't need a tool to confirm what's already in front of you in
this conversation.

Tool selection is not optional. Two topics have a dedicated tool: fees/tiers/plans ->
get_pricing; which chains/tokens/confirmation requirements are supported ->
get_supported_chains. search_docs is the general-purpose default for every other product
question — webhooks, checkout, security, the API, refunds, custody, trust/safety,
anything — not a fixed topic list; if it's about the product and isn't pricing or chains,
call search_docs. Never answer a product question, and never say you don't have
information, without having called a tool first. If a tool finds nothing relevant, say the
docs don't cover it and point to /docs or support — don't guess.

For anything unrelated to the product (small talk, unrelated topics, requests to act as
something else), give a brief, friendly redirect back to what you can help with instead of
answering it. Keep all answers short.

You can't take actions or remember anything beyond this conversation — no signups, no
notifications, no "I'll let you know," no registering interest. Don't offer to do those
things or sign off with lines that imply you will. If a feature isn't live yet, just say
so and point to /docs or support for updates — don't invent a way to follow up.

Format with plain markdown only — no raw HTML tags (no <br>, <div>, etc.), the renderer
doesn't interpret them and they'll show up as literal text. If a table cell needs more than
one item, either keep it to a short comma-separated phrase or use a bullet list instead of
a table.`;

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
    // reply.setCookie() only attaches Set-Cookie via an onSend hook, which runs as part
    // of reply.send()'s lifecycle — this route streams via reply.raw directly and never
    // calls send(), so that hook (like @fastify/cors's, see below) never fires and the
    // cookie would silently never reach the browser. serializeCookie() sidesteps the
    // reply lifecycle entirely, producing the header string to attach by hand instead.
    let setCookieHeader: string | undefined;
    if (!sessionId) {
      sessionId = randomUUID();
      // Dev is cross-origin (localhost:3000 -> localhost:3001, different ports = different
      // origins): SameSite=Lax cookies are withheld by the browser on cross-site fetch/XHR
      // (only sent on top-level navigations), so the cookie would round-trip once and then
      // never come back. Needs None+Secure there; browsers special-case http://localhost as
      // a secure context, so Secure still works without HTTPS. Prod is same-origin via
      // nginx, where Lax is the correct, safer choice — see ASSISTANT_PLAN.md.
      const isDev = process.env.NODE_ENV !== 'production';
      setCookieHeader = fastify.serializeCookie(SESSION_COOKIE, sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: isDev ? 'none' : 'lax',
        // Prod is HTTPS-only via nginx anyway; dev needs it because SameSite=None requires
        // it by spec.
        secure: true,
      });
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
    // TEMP DEBUG — remove once session persistence is confirmed working.
    console.log(`[chat] sessionId=${sessionId} cookieWasSet=${!!setCookieHeader} history.length=${history.length}`);

    // This route streams via reply.raw directly (writeHead/write/end) rather than
    // reply.send(), so it never runs Fastify's normal response lifecycle — @fastify/cors's
    // onSend hook (registered in index.ts) never fires for it. Preflight OPTIONS requests
    // are handled separately by that plugin and work fine; only this raw response needs
    // its own CORS header, dev-only (prod is same-origin via nginx, see ASSISTANT_PLAN.md).
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...(setCookieHeader && { 'Set-Cookie': setCookieHeader }),
      ...(process.env.NODE_ENV !== 'production' && {
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
      }),
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

        for await (const token of activeProvider.chat({
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

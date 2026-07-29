import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from './redis';
import { config } from './config';

// Deliberately below Groq's free-tier ceiling, so we degrade predictably ("try again in
// a minute") instead of surfacing random 429s from upstream — see "LLM layer" in
// ASSISTANT_PLAN.md.
export const chatRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'assistant:ratelimit',
  points: config.chatRateLimit.points,
  duration: config.chatRateLimit.durationSeconds,
});

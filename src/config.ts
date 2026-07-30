import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),

  // Which AssistantProvider (src/llm/) handles chat — see src/llm/index.ts for the
  // registry this selects from.
  llmProvider: process.env.LLM_PROVIDER ?? 'groq',

  groq: {
    apiKey: required('GROQ_API_KEY'),
    // gpt-oss, not llama-3.3-70b-versatile: the latter is a well-documented, ongoing
    // (reports through Apr 2026) source of malformed <function=name{args}> tool-call
    // generations on Groq — it's a third-party fine-tune not natively trained on the
    // OpenAI-style tool-call format Groq's API validates against. gpt-oss is OpenAI's
    // own open-weight model, trained on that exact format, and free-tier on Groq.
    model: process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b',
  },

  chatRateLimit: {
    points: Number(process.env.CHAT_RATE_LIMIT_POINTS ?? 10),
    durationSeconds: Number(process.env.CHAT_RATE_LIMIT_DURATION_SECONDS ?? 60),
  },

  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 3600),
};

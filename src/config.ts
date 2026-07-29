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

  groq: {
    apiKey: required('GROQ_API_KEY'),
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  },

  chatRateLimit: {
    points: Number(process.env.CHAT_RATE_LIMIT_POINTS ?? 10),
    durationSeconds: Number(process.env.CHAT_RATE_LIMIT_DURATION_SECONDS ?? 60),
  },

  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 3600),
};

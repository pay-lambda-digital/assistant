import {
  AssistantConversation,
  AssistantMessage,
  AssistantUserMemory,
} from '@pay-lambda-digital/entities';
import { db } from './db';
import { redis } from './redis';
import { config } from './config';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_HISTORY_TURNS = 10;

// Anonymous visitors: raw last-N turns in Redis, TTL-bound — see the "Memory" table in
// ASSISTANT_PLAN.md.
function sessionKey(sessionId: string): string {
  return `assistant:session:${sessionId}`;
}

export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  const raw = await redis.get(sessionKey(sessionId));
  return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
}

export async function appendSessionHistory(sessionId: string, message: ChatMessage): Promise<void> {
  const history = await getSessionHistory(sessionId);
  const trimmed = [...history, message].slice(-MAX_HISTORY_TURNS);
  await redis.set(sessionKey(sessionId), JSON.stringify(trimmed), 'EX', config.sessionTtlSeconds);
}

// Signed-in users: persisted conversation history + a periodically-summarized long-term
// memory, never a raw transcript dump.
export async function getOrCreateConversation(userId: string): Promise<string> {
  const repo = db.getRepository(AssistantConversation);
  const existing = await repo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
  if (existing) return existing.id;
  const created = await repo.save(repo.create({ userId }));
  return created.id;
}

export async function appendMessage(conversationId: string, role: string, content: string): Promise<void> {
  const repo = db.getRepository(AssistantMessage);
  await repo.save(repo.create({ conversationId, role, content }));
}

export async function getConversationHistory(
  conversationId: string,
  limit = MAX_HISTORY_TURNS,
): Promise<ChatMessage[]> {
  const repo = db.getRepository(AssistantMessage);
  const messages = await repo.find({
    where: { conversationId },
    order: { createdAt: 'DESC' },
    take: limit,
  });
  return messages.reverse().map((m) => ({ role: m.role as ChatMessage['role'], content: m.content }));
}

export async function getUserMemory(userId: string): Promise<string | null> {
  const memory = await db.getRepository(AssistantUserMemory).findOneBy({ userId });
  return memory?.summary ?? null;
}

export async function setUserMemory(userId: string, summary: string): Promise<void> {
  const repo = db.getRepository(AssistantUserMemory);
  const existing = await repo.findOneBy({ userId });
  if (existing) {
    await repo.update(existing.id, { summary });
  } else {
    await repo.save(repo.create({ userId, summary }));
  }
}

// "Clear assistant history" — dashboard settings action, see ASSISTANT_PLAN.md.
export async function clearUserMemory(userId: string): Promise<void> {
  await db.getRepository(AssistantUserMemory).delete({ userId });
  const conversations = await db.getRepository(AssistantConversation).find({ where: { userId } });
  for (const conversation of conversations) {
    await db.getRepository(AssistantMessage).delete({ conversationId: conversation.id });
  }
  await db.getRepository(AssistantConversation).delete({ userId });
}

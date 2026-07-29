import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  DocChunk,
  StructuredFact,
  AssistantAnswerCache,
  AssistantConversation,
  AssistantMessage,
  AssistantUserMemory,
} from '@pay-lambda-digital/entities';
import { config } from './config';

export const db = new DataSource({
  type: 'postgres',
  url: config.databaseUrl,
  entities: [
    DocChunk,
    StructuredFact,
    AssistantAnswerCache,
    AssistantConversation,
    AssistantMessage,
    AssistantUserMemory,
  ],
  synchronize: false,
  logging: false,
});

export async function connectDb(): Promise<void> {
  await db.initialize();
  console.log('[db] connected');
}

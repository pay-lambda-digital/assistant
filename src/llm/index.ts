import { config } from '../config';
import { groqProvider } from './groq';
import type { AssistantProvider } from './types';

// Registry of available providers, keyed by LLM_PROVIDER. To add another (e.g. OpenAI,
// Anthropic): implement AssistantProvider (see types.ts) in its own file under src/llm/,
// then add one line here — nothing outside this file or the new provider file changes.
const providers: Record<string, AssistantProvider> = {
  groq: groqProvider,
};

const provider = providers[config.llmProvider];
if (!provider) {
  throw new Error(
    `Unknown LLM_PROVIDER "${config.llmProvider}" — available: ${Object.keys(providers).join(', ')}`,
  );
}

export const activeProvider: AssistantProvider = provider;

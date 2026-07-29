import type { AssistantProvider, ChatMessage, ToolDefinition, ToolCall } from '../../src/llm/types';

export interface FakeProviderCall {
  messages: ChatMessage[];
  tools: ToolDefinition[];
}

export interface FakeAssistantProvider extends AssistantProvider {
  calls: FakeProviderCall[];
}

// Test double for AssistantProvider — lets tests exercise the tool-calling loop
// (chat.ts, mcp/tools.ts) without ever calling Groq: no real API key, no cost, no
// non-determinism, works offline in CI. Optionally scripted to request tool calls
// before yielding the final answer, same shape a real provider would produce.
export function createFakeProvider(opts: {
  finalAnswer: string;
  toolCallsToRequest?: Array<Omit<ToolCall, 'id'>>;
}): FakeAssistantProvider {
  const calls: FakeProviderCall[] = [];

  return {
    calls,
    async *chat({ messages, tools, onToolCall }) {
      calls.push({ messages, tools });

      for (const [i, call] of (opts.toolCallsToRequest ?? []).entries()) {
        await onToolCall({ id: `fake-${i}`, name: call.name, arguments: call.arguments });
      }

      yield opts.finalAnswer;
    },
  };
}

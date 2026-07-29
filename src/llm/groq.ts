import Groq from 'groq-sdk';
import { config } from '../config';
import type { AssistantProvider, ChatMessage, ToolDefinition } from './types';

const client = new Groq({ apiKey: config.groq.apiKey });

// Derived from groq-sdk's own signature rather than hand-typed, so this stays correct
// across SDK versions instead of drifting from whatever the installed types actually are.
type CreateParams = Parameters<typeof client.chat.completions.create>[0];
type GroqMessage = CreateParams['messages'][number];
type GroqTool = NonNullable<CreateParams['tools']>[number];

const MAX_TOOL_ROUNDS = 3;

function toGroqTools(tools: ToolDefinition[]): GroqTool[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function toGroqMessages(messages: ChatMessage[]): GroqMessage[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' } as GroqMessage;
    }
    return { role: m.role, content: m.content } as GroqMessage;
  });
}

export const groqProvider: AssistantProvider = {
  async *chat({ messages, tools, onToolCall }) {
    const conversation: GroqMessage[] = toGroqMessages(messages);
    const groqTools = tools.length > 0 ? toGroqTools(tools) : undefined;

    // Non-streamed rounds: let the model call search_docs/get_pricing/get_supported_chains
    // until it stops asking for them or we hit the round cap — see "MCP" in ASSISTANT_PLAN.md.
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await client.chat.completions.create({
        model: config.groq.model,
        messages: conversation,
        tools: groqTools,
      });

      const responseMessage = completion.choices[0]?.message;
      const toolCalls = responseMessage?.tool_calls;
      if (!responseMessage || !toolCalls || toolCalls.length === 0) break;

      conversation.push(responseMessage as GroqMessage);

      for (const call of toolCalls) {
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const result = await onToolCall({ id: call.id, name: call.function.name, arguments: args });
        conversation.push({ role: 'tool', tool_call_id: call.id, content: result } as GroqMessage);
      }
    }

    // Final answer, streamed token-by-token to the client.
    const stream = await client.chat.completions.create({
      model: config.groq.model,
      messages: conversation,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  },
};

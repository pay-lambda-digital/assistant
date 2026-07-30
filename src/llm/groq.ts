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
const TOOL_CALL_RETRY_ATTEMPTS = 3;
// Escalating, not flat — observed twice now (Llama 3.3's <function=...> fusion, gpt-oss's
// <|channel|>final Harmony-format leak) that a stuck malformed generation reproduces
// identically at low/near-deterministic temperature: retrying at the same temperature
// just re-runs into the same failure. Each retry needs an actual chance at a different
// sample, so temperature climbs per attempt instead of staying pinned at 0.1.
const RETRY_TEMPERATURES = [0.1, 0.4, 0.8];

function isToolUseFailed(err: unknown): boolean {
  const body = err instanceof Groq.APIError ? (err.error as { error?: { code?: string } }) : undefined;
  return err instanceof Groq.APIError && err.status === 400 && body?.error?.code === 'tool_use_failed';
}

async function retryOnToolUseFailed<T>(fn: (temperature: number) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(RETRY_TEMPERATURES[attempt - 1] ?? RETRY_TEMPERATURES[RETRY_TEMPERATURES.length - 1]);
    } catch (err) {
      if (!isToolUseFailed(err) || attempt >= TOOL_CALL_RETRY_ATTEMPTS) throw err;
    }
  }
}

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
    let finalContent: string | undefined;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await retryOnToolUseFailed((temperature) =>
        client.chat.completions.create({
          model: config.groq.model,
          messages: conversation,
          tools: groqTools,
          // Groq's default sampling temperature is tuned for conversational replies, not
          // strict tool-call formatting — malformed tool-call generations are far more
          // common at that default than at low temperature, so the first attempt runs low.
          // Only the tool-selection rounds need this; the final freeform answer keeps the
          // default. See RETRY_TEMPERATURES for why this climbs on retry.
          temperature,
        }),
      );

      const responseMessage = completion.choices[0]?.message;
      const toolCalls = responseMessage?.tool_calls;
      // TEMP DEBUG — remove once tool selection with the new model is confirmed working.
      console.log(
        `[groq] round ${round}: tool_calls=${toolCalls?.map((c) => c.function.name).join(',') || 'none'}`,
        toolCalls ? '' : `content="${responseMessage?.content?.slice(0, 200)}"`,
      );
      if (!responseMessage || !toolCalls || toolCalls.length === 0) {
        // The model already gave its final answer right here — use it directly. This used
        // to be discarded in favor of a second, independent streamed call, which silently
        // produced *different* answers on resample (observed: it would inconsistently
        // drop earlier conversational context, like an instruction to use a specific name,
        // because it was a fresh, non-deterministic generation, not the same one).
        finalContent = responseMessage?.content ?? undefined;
        break;
      }

      conversation.push(responseMessage as GroqMessage);

      for (const call of toolCalls) {
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const result = await onToolCall({ id: call.id, name: call.function.name, arguments: args });
        conversation.push({ role: 'tool', tool_call_id: call.id, content: result } as GroqMessage);
      }
    }

    if (finalContent !== undefined) {
      yield finalContent;
      return;
    }

    // Only reached if the round budget was exhausted while the model still wanted to call
    // tools — force a stop and get an answer. tool_choice: 'none' is required here, not
    // just omitting `tools` — the model (Llama 3.3 or gpt-oss, observed with both) will
    // still attempt a tool call on its own initiative even when none are declared or
    // explicitly forbidden. Unlike the tool-selection rounds above, Groq surfaces that as
    // a 400 *mid-stream* (once iteration starts), not from create() itself — so it needs
    // its own retry around stream consumption, not just the call.
    for (let attempt = 1; ; attempt++) {
      const stream = await client.chat.completions.create({
        model: config.groq.model,
        messages: conversation,
        tools: groqTools,
        tool_choice: 'none',
        stream: true,
        // First attempt keeps Groq's own default (already reasonably high-entropy for a
        // freeform answer); only nudge temperature on retries, same reasoning as
        // RETRY_TEMPERATURES above — give a stuck generation an actual chance to differ.
        ...(attempt > 1 && { temperature: RETRY_TEMPERATURES[attempt - 1] }),
      });

      let yieldedAny = false;
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            yieldedAny = true;
            yield delta;
          }
        }
        return;
      } catch (err) {
        // If we'd already streamed part of an answer to the client, restarting would
        // duplicate/corrupt it — only safe to retry when the failure hit before any
        // content went out, which is what's actually been observed (the forbidden
        // tool-call attempt is the model's first token, ahead of any real answer).
        if (yieldedAny || !isToolUseFailed(err) || attempt >= TOOL_CALL_RETRY_ATTEMPTS) throw err;
      }
    }
  },
};

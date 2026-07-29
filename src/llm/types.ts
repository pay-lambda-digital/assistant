// Concrete form of the AssistantProvider sketch in ASSISTANT_PLAN.md — swapping LLM
// provider later means implementing this interface once, nowhere else changes.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AssistantProvider {
  chat(params: {
    messages: ChatMessage[];
    tools: ToolDefinition[];
    onToolCall: (call: ToolCall) => Promise<string>;
  }): AsyncIterable<string>;
}

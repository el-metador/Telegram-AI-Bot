export type ChatProvider = 'openrouter' | 'groq';

export type PowerTier = 'Low' | 'Medium' | 'High' | 'eHigh';

export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatCompletionRequest {
  provider: ChatProvider;
  model: string;
  systemPrompt?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  provider: ChatProvider;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  latencyMs: number;
}

export interface LlmProviderAdapter {
  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  healthcheck(): Promise<boolean>;
}

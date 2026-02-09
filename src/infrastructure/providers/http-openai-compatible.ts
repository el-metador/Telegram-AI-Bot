import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  LlmProviderAdapter,
  ChatProvider,
} from '../../shared/types/llm.js';

interface OpenAICompatibleOptions {
  provider: ChatProvider;
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
}

interface CompletionChoice {
  message?: {
    content?: string;
  };
}

interface CompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface CompletionPayload {
  choices?: CompletionChoice[];
  usage?: CompletionUsage;
}

export class OpenAICompatibleAdapter implements LlmProviderAdapter {
  private readonly provider: ChatProvider;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleOptions) {
    this.provider = options.provider;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 45000;
    this.extraHeaders = options.extraHeaders ?? {};
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          temperature: req.temperature,
          max_tokens: req.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Provider ${this.provider} error ${response.status}: ${body}`);
      }

      const payload = (await response.json()) as CompletionPayload;
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error(`Provider ${this.provider} returned empty content`);
      }

      return {
        content,
        model: req.model,
        provider: this.provider,
        usage: {
          promptTokens: payload.usage?.prompt_tokens,
          completionTokens: payload.usage?.completion_tokens,
          totalTokens: payload.usage?.total_tokens,
        },
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthcheck(): Promise<boolean> {
    return true;
  }
}

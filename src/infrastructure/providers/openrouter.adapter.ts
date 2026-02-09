import type { LlmProviderAdapter } from '../../shared/types/llm.js';
import { OpenAICompatibleAdapter } from './http-openai-compatible.js';

export const createOpenRouterAdapter = (apiKey: string): LlmProviderAdapter =>
  new OpenAICompatibleAdapter({
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey,
    extraHeaders: {
      'HTTP-Referer': 'https://telegram.org',
      'X-Title': 'Multi AI Telegram Bot',
    },
  });

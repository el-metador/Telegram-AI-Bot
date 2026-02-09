import type { LlmProviderAdapter } from '../../shared/types/llm.js';
import { OpenAICompatibleAdapter } from './http-openai-compatible.js';

export const createGroqAdapter = (apiKey: string): LlmProviderAdapter =>
  new OpenAICompatibleAdapter({
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey,
  });

import type { ChatProvider, LlmProviderAdapter } from '../../shared/types/llm.js';

export class ProviderRouter {
  constructor(
    private readonly openRouterAdapter: LlmProviderAdapter,
    private readonly groqAdapter: LlmProviderAdapter,
  ) {}

  get(provider: ChatProvider): LlmProviderAdapter {
    return provider === 'openrouter' ? this.openRouterAdapter : this.groqAdapter;
  }
}

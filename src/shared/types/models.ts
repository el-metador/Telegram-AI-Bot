import type { ChatProvider, PowerTier } from './llm.js';

export interface ModelStars {
  coding: number;
  reasoning: number;
  multilingual: number;
  speed: number;
  safety: number;
}

export type ModelMetric = keyof ModelStars | 'balanced';
export type ProviderFilter = ChatProvider | 'all';

export interface ModelCard {
  provider: ChatProvider;
  modelId: string;
  title: string;
  powerTier: PowerTier;
  tags: string[];
  stars: ModelStars;
}

export interface ProviderCatalog {
  baseUrl: string;
  models: Omit<ModelCard, 'provider'>[];
}

export interface ModelsCatalog {
  version: number;
  providers: Record<ChatProvider, ProviderCatalog>;
}

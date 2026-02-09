import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ChatProvider, PowerTier } from '../../shared/types/llm.js';
import type { ModelCard, ModelMetric, ModelsCatalog, ProviderFilter } from '../../shared/types/models.js';

export class ModelCatalogService {
  private readonly catalog: ModelsCatalog;

  constructor(catalogPath = path.resolve(process.cwd(), 'config/models.catalog.json')) {
    const raw = readFileSync(catalogPath, 'utf8');
    this.catalog = JSON.parse(raw) as ModelsCatalog;
  }

  getAllProviders(): ChatProvider[] {
    return Object.keys(this.catalog.providers) as ChatProvider[];
  }

  getModelCard(provider: ChatProvider, modelId: string): ModelCard | null {
    const providerCatalog = this.catalog.providers[provider];
    const model = providerCatalog?.models.find((item) => item.modelId === modelId);
    if (!model) {
      return null;
    }
    return { provider, ...model };
  }

  listModels(provider: ChatProvider, powerTier?: PowerTier): ModelCard[] {
    const providerCatalog = this.catalog.providers[provider];
    if (!providerCatalog) {
      return [];
    }

    return providerCatalog.models
      .filter((model) => !powerTier || model.powerTier === powerTier)
      .map((model) => ({ provider, ...model }));
  }

  listAllModels(powerTier?: PowerTier): ModelCard[] {
    const providers = this.getAllProviders();
    const all = providers.flatMap((provider) => this.listModels(provider, powerTier));
    return all;
  }

  findDefaultModel(provider: ChatProvider, powerTier: PowerTier): ModelCard | null {
    const exact = this.listModels(provider, powerTier)[0];
    if (exact) {
      return exact;
    }
    return this.listModels(provider)[0] ?? null;
  }

  isModelExists(provider: ChatProvider, modelId: string): boolean {
    return Boolean(this.getModelCard(provider, modelId));
  }

  rankModels(options: {
    metric: ModelMetric;
    provider: ProviderFilter;
    powerTier?: PowerTier;
    limit?: number;
  }): ModelCard[] {
    const { metric, provider, powerTier, limit = 20 } = options;

    const source =
      provider === 'all' ? this.listAllModels(powerTier) : this.listModels(provider, powerTier);

    return source
      .slice()
      .sort((a, b) => {
        const scoreDelta = this.score(b, metric) - this.score(a, metric);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        const secondaryDelta = this.score(b, 'balanced') - this.score(a, 'balanced');
        if (secondaryDelta !== 0) {
          return secondaryDelta;
        }

        return a.title.localeCompare(b.title);
      })
      .slice(0, limit);
  }

  score(model: ModelCard, metric: ModelMetric): number {
    if (metric === 'balanced') {
      const values = Object.values(model.stars);
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    return model.stars[metric];
  }
}

import type { ChatProvider, PowerTier } from '../../shared/types/llm.js';
import type { UserSettings } from '../../domain/entities/user-settings.js';
import { defaultUserSettings } from '../../domain/entities/user-settings.js';
import type { UserSettingsGateway } from '../../application/ports/user-settings.gateway.js';

export class InMemoryUserSettingsStore implements UserSettingsGateway {
  private readonly byUser = new Map<string, UserSettings>();

  async getByUserId(userId: string): Promise<UserSettings> {
    return this.getOrCreate(userId);
  }

  async setSelectedModel(userId: string, provider: ChatProvider, modelId: string): Promise<void> {
    const current = this.getOrCreate(userId);
    this.byUser.set(userId, {
      ...current,
      selectedProvider: provider,
      selectedModel: modelId,
      updatedAt: new Date().toISOString(),
    });
  }

  async setPowerTier(userId: string, powerTier: PowerTier): Promise<void> {
    const current = this.getOrCreate(userId);
    this.byUser.set(userId, {
      ...current,
      selectedPowerTier: powerTier,
      updatedAt: new Date().toISOString(),
    });
  }

  async setSystemPrompt(userId: string, prompt: string): Promise<void> {
    const current = this.getOrCreate(userId);
    this.byUser.set(userId, {
      ...current,
      systemPrompt: prompt,
      updatedAt: new Date().toISOString(),
    });
  }

  async setPendingInput(userId: string, pendingInput: UserSettings['pendingInput']): Promise<void> {
    const current = this.getOrCreate(userId);
    this.byUser.set(userId, {
      ...current,
      pendingInput,
      updatedAt: new Date().toISOString(),
    });
  }

  private getOrCreate(userId: string): UserSettings {
    const existing = this.byUser.get(userId);
    if (existing) {
      return existing;
    }

    const created = defaultUserSettings(userId);
    this.byUser.set(userId, created);
    return created;
  }
}

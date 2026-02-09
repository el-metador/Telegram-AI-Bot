import type { ChatProvider, PowerTier } from '../../shared/types/llm.js';
import type { UserSettings } from '../../domain/entities/user-settings.js';

export interface UserSettingsGateway {
  getByUserId(userId: string): Promise<UserSettings>;
  setSelectedModel(userId: string, provider: ChatProvider, modelId: string): Promise<void>;
  setPowerTier(userId: string, powerTier: PowerTier): Promise<void>;
  setSystemPrompt(userId: string, prompt: string): Promise<void>;
  setPendingInput(userId: string, pendingInput: UserSettings['pendingInput']): Promise<void>;
}

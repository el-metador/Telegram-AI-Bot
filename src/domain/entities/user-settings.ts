import type { ChatProvider, PowerTier } from '../../shared/types/llm.js';

export interface UserSettings {
  telegramId: string;
  selectedProvider: ChatProvider;
  selectedModel: string;
  selectedPowerTier: PowerTier;
  systemPrompt: string;
  pendingInput: 'system_prompt' | 'build_request' | null;
  updatedAt: string;
}

export const defaultUserSettings = (telegramId: string): UserSettings => ({
  telegramId,
  selectedProvider: 'openrouter',
  selectedModel: 'google/gemma-3n-e4b-it:free',
  selectedPowerTier: 'Low',
  systemPrompt: '',
  pendingInput: null,
  updatedAt: new Date().toISOString(),
});

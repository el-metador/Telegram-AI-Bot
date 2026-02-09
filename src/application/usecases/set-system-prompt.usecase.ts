import type { UserSettingsGateway } from '../ports/user-settings.gateway.js';

export class SetSystemPromptUseCase {
  constructor(private readonly userSettingsGateway: UserSettingsGateway) {}

  async execute(userId: string, prompt: string): Promise<void> {
    const normalizedPrompt = prompt.trim();

    if (normalizedPrompt.length > 4000) {
      throw new Error('System prompt is too long. Max length is 4000 characters.');
    }

    await this.userSettingsGateway.setSystemPrompt(userId, normalizedPrompt);
  }
}

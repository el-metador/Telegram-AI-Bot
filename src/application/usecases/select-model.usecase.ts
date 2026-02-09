import type { ChatProvider } from '../../shared/types/llm.js';
import type { UserSettingsGateway } from '../ports/user-settings.gateway.js';

export class SelectModelUseCase {
  constructor(private readonly userSettingsGateway: UserSettingsGateway) {}

  async execute(userId: string, provider: ChatProvider, modelId: string): Promise<void> {
    await this.userSettingsGateway.setSelectedModel(userId, provider, modelId);
  }
}

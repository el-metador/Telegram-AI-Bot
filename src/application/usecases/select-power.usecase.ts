import type { PowerTier } from '../../shared/types/llm.js';
import type { UserSettingsGateway } from '../ports/user-settings.gateway.js';

export class SelectPowerUseCase {
  constructor(private readonly userSettingsGateway: UserSettingsGateway) {}

  async execute(userId: string, powerTier: PowerTier): Promise<void> {
    await this.userSettingsGateway.setPowerTier(userId, powerTier);
  }
}

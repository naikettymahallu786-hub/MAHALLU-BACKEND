import { SettingsRepository } from '../repositories/settings.repository';

export class SettingsService {
  static async getForTenant(tenantId: string) {
    return SettingsRepository.findByTenant(tenantId);
  }

  static async upsertForTenant(tenantId: string, body: Record<string, unknown>) {
    return SettingsRepository.upsertForTenant(tenantId, body);
  }
}

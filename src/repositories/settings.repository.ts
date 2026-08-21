import { Settings } from '../models/Settings';

export class SettingsRepository {
  static async findByTenant(tenantId: string) {
    return Settings.findOne({ tenantId }).lean();
  }

  static async upsertForTenant(tenantId: string, data: Record<string, unknown>) {
    return Settings.findOneAndUpdate({ tenantId }, { ...data, tenantId }, { upsert: true, new: true });
  }
}

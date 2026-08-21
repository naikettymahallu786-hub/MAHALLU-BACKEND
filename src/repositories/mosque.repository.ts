import { Mosque } from '../models/Mosque';

export class MosqueRepository {
  static async findByTenant(tenantId: string) {
    return Mosque.findOne({ tenantId }).populate('imamId muazzinId committee.memberId', 'name phone photo').lean();
  }

  static async upsertForTenant(tenantId: string, data: Record<string, unknown>) {
    return Mosque.findOneAndUpdate({ tenantId }, { ...data, tenantId }, { upsert: true, new: true });
  }
}

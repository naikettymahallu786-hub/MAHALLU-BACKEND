import { Madrasa } from '../models/Madrasa';

export class MadrasaRepository {
  static async findByTenant(tenantId: string) {
    return Madrasa.findOne({ tenantId }).populate('principalId', 'name').lean();
  }

  static async upsertForTenant(tenantId: string, data: Record<string, unknown>) {
    return Madrasa.findOneAndUpdate({ tenantId }, { ...data, tenantId }, { upsert: true, new: true });
  }

  // Hydrated (non-lean, non-populated) document for callers that need to
  // mutate and .save() it — e.g. pushing a new class ID onto `classes`.
  static async findByTenantRaw(tenantId: string) {
    return Madrasa.findOne({ tenantId });
  }
}

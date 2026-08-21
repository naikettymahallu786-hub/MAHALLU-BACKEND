import { DeathRecord } from '../models/DeathRecord';

export class DeathRepository {
  static async findAllByTenant(tenantId: string) {
    return DeathRecord.find({ tenantId }).populate('memberId', 'name photo').sort({ dateOfDeath: -1 }).lean();
  }

  static async create(data: Record<string, unknown>) {
    return DeathRecord.create(data);
  }
}

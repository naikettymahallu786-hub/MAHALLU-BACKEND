import { Lease } from '../models/Lease';

export class LeaseRepository {
  static async findByPropertyAndTenant(tenantId: string, propertyId: string) {
    return Lease.find({ tenantId, propertyId }).populate('tenantMemberId', 'name phone').lean();
  }

  static async create(data: Record<string, unknown>) {
    return Lease.create(data);
  }
}

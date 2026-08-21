import { Property } from '../models/Property';

export class PropertyRepository {
  static async findAllByTenant(tenantId: string) {
    return Property.find({ tenantId }).lean();
  }

  static async count(tenantId: string) {
    return Property.countDocuments({ tenantId });
  }

  static async create(data: Record<string, unknown>) {
    return Property.create(data);
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Property.findOne({ _id: id, tenantId }).populate('currentLeaseId').lean();
  }

  // Hydrated document for callers that mutate and .save() (rental-request
  // approval decrements availableQuantity).
  static async findByIdAndTenantRaw(id: string, tenantId: string) {
    return Property.findOne({ _id: id, tenantId });
  }

  static async setCurrentLeaseAndOccupied(id: string, leaseId: unknown) {
    await Property.findByIdAndUpdate(id, { currentLeaseId: leaseId, status: 'occupied' });
  }

  static async updateByIdAndTenant(id: string, tenantId: string, data: Record<string, unknown>) {
    return Property.findOneAndUpdate({ _id: id, tenantId }, data, { new: true, runValidators: true });
  }
}

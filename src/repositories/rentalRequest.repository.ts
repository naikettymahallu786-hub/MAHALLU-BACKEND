import { RentalRequest } from '../models/RentalRequest';

export class RentalRequestRepository {
  static async findAllByTenant(tenantId: string) {
    return RentalRequest.find({ tenantId })
      .populate('requestedBy', 'name phone')
      .populate('propertyId', 'name type')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return RentalRequest.findOne({ _id: id, tenantId })
      .populate('requestedBy', 'name phone email')
      .populate('propertyId', 'name propertyCode type quantity availableQuantity')
      .lean();
  }

  // Hydrated document — approve/reject mutate status and .save().
  static async findByIdAndTenantRaw(id: string, tenantId: string) {
    return RentalRequest.findOne({ _id: id, tenantId });
  }
}

import { Certificate } from '../models/Certificate';

export class CertificateRepository {
  static async findAllByTenant(tenantId: string) {
    return Certificate.find({ tenantId })
      .populate('recipientId', 'name memberId phone email relationship')
      .populate('issuedBy', 'name role')
      .sort({ issuedAt: -1 })
      .lean();
  }

  static async count(tenantId: string) {
    return Certificate.countDocuments({ tenantId });
  }

  static async create(data: Record<string, unknown>) {
    return Certificate.create(data);
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Certificate.findOne({ _id: id, tenantId })
      .populate('recipientId', 'name memberId phone email relationship familyId address')
      .populate('issuedBy', 'name role')
      .populate('tenantId', 'name code address logo')
      .lean();
  }
}

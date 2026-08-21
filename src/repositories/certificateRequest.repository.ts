import { CertificateRequest } from '../models/CertificateRequest';

export class CertificateRequestRepository {
  static async findAllByTenant(tenantId: string, status?: string) {
    const query: Record<string, unknown> = { tenantId };
    if (status) query.status = status;

    return CertificateRequest.find(query)
      .populate('requestedBy', 'name memberId phone email relationship familyId')
      .populate('certificateId')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return CertificateRequest.findOne({ _id: id, tenantId })
      .populate('requestedBy', 'name memberId phone email relationship familyId')
      .populate('certificateId')
      .lean();
  }

  // Hydrated document — approve/reject mutate status and .save().
  static async findByIdAndTenantRaw(id: string, tenantId: string) {
    return CertificateRequest.findOne({ _id: id, tenantId });
  }
}

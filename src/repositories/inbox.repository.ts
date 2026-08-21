import { RegistrationRequest } from '../models/RegistrationRequest';
import { CertificateRequest } from '../models/CertificateRequest';
import { RentalRequest } from '../models/RentalRequest';

export class InboxRepository {
  static async findRegistrations(tenantId: string, statusQuery: unknown) {
    return RegistrationRequest.find({ tenantId, status: statusQuery }).sort({ createdAt: -1 }).lean();
  }

  static async findCertificateRequests(tenantId: string, statusQuery: unknown) {
    return CertificateRequest.find({ tenantId, status: statusQuery })
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async findRentalRequests(tenantId: string, statusQuery: unknown) {
    return RentalRequest.find({ tenantId, status: statusQuery })
      .populate('requestedBy', 'name phone')
      .populate('propertyId', 'name propertyCode')
      .sort({ createdAt: -1 })
      .lean();
  }
}

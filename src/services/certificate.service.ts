import { AppError } from '../middleware/errorHandler';
import { CertificateRepository } from '../repositories/certificate.repository';
import { CertificateRequestRepository } from '../repositories/certificateRequest.repository';
import { generateSequentialId } from '../domain/idGenerator';
import { CertificateType } from "../types";

export class CertificateService {
  static async getAll(tenantId: string) {
    return CertificateRepository.findAllByTenant(tenantId);
  }

  static async getAllRequests(tenantId: string, status?: string) {
    return CertificateRequestRepository.findAllByTenant(tenantId, status);
  }

  static async getRequestById(id: string, tenantId: string) {
    const request = await CertificateRequestRepository.findByIdAndTenant(id, tenantId);
    if (!request) throw new AppError('Request not found', 404);
    return request;
  }

  static async approveRequest(
    id: string,
    tenantId: string,
    userId: string,
    body: {
      type?: string;
      details?: Record<string, unknown>;
      eSign?: { isSigned?: boolean; signedBy?: string; designation?: string };
      eStamp?: { isStamped?: boolean; sealTitle?: string };
      customCertificateNo?: string;
    },
  ) {
    const request = await CertificateRequestRepository.findByIdAndTenantRaw(id, tenantId);
    if (!request) throw new AppError('Request not found', 404);

    const { type, details, eSign, eStamp, customCertificateNo } = body;

    const count = await CertificateRepository.count(tenantId);
    const certificateNo = customCertificateNo || generateSequentialId('CERT', count, { padWidth: 5 });

    const certType = type || request.type || CertificateType.RESIDENCE;
    const certDetails = {
      ...(request.details || {}),
      ...(details || {}),
      purpose: request.purpose,
    };

    const cert = await CertificateRepository.create({
      tenantId,
      certificateNo,
      type: certType,
      recipientId: request.requestedBy,
      issuedBy: userId,
      issuedAt: new Date(),
      data: certDetails,
      eSign: {
        isSigned: eSign?.isSigned ?? true,
        signedBy: eSign?.signedBy || 'Secretary, Mahallu Committee',
        designation: eSign?.designation || 'Authorized Signatory',
      },
      eStamp: {
        isStamped: eStamp?.isStamped ?? true,
        sealTitle: eStamp?.sealTitle || 'Official Seal of Mahallu Committee',
      },
    });

    request.status = 'APPROVED';
    request.certificateId = cert._id as any;
    if (type) request.type = type as any;
    await request.save();

    return cert;
  }

  static async rejectRequest(id: string, tenantId: string, notes?: string) {
    const request = await CertificateRequestRepository.findByIdAndTenantRaw(id, tenantId);
    if (!request) throw new AppError('Request not found', 404);

    request.status = 'REJECTED';
    if (notes) request.notes = notes;
    await request.save();
  }

  static async getById(id: string, tenantId: string) {
    const cert = await CertificateRepository.findByIdAndTenant(id, tenantId);
    if (!cert) throw new AppError('Certificate not found', 404);
    return cert;
  }
}

import { ZakatRepository } from '../repositories/zakat.repository';

export class ZakatService {
  static async getAll(tenantId: string) {
    return ZakatRepository.findAllByTenant(tenantId);
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    return ZakatRepository.create({ ...body, tenantId });
  }

  // Preserves the exact pre-existing behavior: no not-found check.
  static async apply(id: string, tenantId: string, body: Record<string, unknown>) {
    return ZakatRepository.addApplicant(id, tenantId, { ...body, status: 'pending' });
  }

  static async updateApplicantStatus(
    id: string,
    tenantId: string,
    memberId: unknown,
    body: { status: unknown; amountApproved: unknown },
  ) {
    await ZakatRepository.updateApplicantStatus(id, tenantId, memberId, body);
  }
}

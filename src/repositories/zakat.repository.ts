import { Zakat } from '../models/Zakat';

export class ZakatRepository {
  static async findAllByTenant(tenantId: string) {
    return Zakat.find({ tenantId }).sort({ year: -1 }).lean();
  }

  static async create(data: Record<string, unknown>) {
    return Zakat.create(data);
  }

  static async addApplicant(id: string, tenantId: string, applicant: Record<string, unknown>) {
    return Zakat.findOneAndUpdate(
      { _id: id, tenantId },
      { $push: { applicants: applicant } },
      { new: true },
    );
  }

  static async updateApplicantStatus(
    id: string,
    tenantId: string,
    memberId: unknown,
    data: { status: unknown; amountApproved: unknown },
  ) {
    await Zakat.updateOne(
      { _id: id, tenantId, 'applicants.memberId': memberId },
      { $set: { 'applicants.$.status': data.status, 'applicants.$.amountApproved': data.amountApproved } },
    );
  }
}

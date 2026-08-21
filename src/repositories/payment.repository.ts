import { Payment } from '../models/Payment';
import { Receipt } from '../models/Receipt';

export class PaymentRepository {
  static async findByIdAndUpdateStatus(id: unknown, data: Record<string, unknown>) {
    return Payment.findByIdAndUpdate(id, data, { new: true });
  }

  static async countReceipts(tenantId: unknown) {
    return Receipt.countDocuments({ tenantId });
  }

  static async createReceipt(data: Record<string, unknown>) {
    return Receipt.create(data);
  }

  static async setPaymentReceiptId(paymentId: unknown, receiptId: unknown) {
    await Payment.findByIdAndUpdate(paymentId, { receiptId });
  }

  static async countPayments(tenantId: string) {
    return Payment.countDocuments({ tenantId });
  }

  static async createPayment(data: Record<string, unknown>) {
    return Payment.create(data);
  }

  static async findFilteredWithPopulate(filter: Record<string, unknown>) {
    return Payment.find(filter)
      .populate('paidById', 'name phone email memberId')
      .populate('paidForId', 'name phone email memberId')
      .populate('receiptId', 'receiptNo')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async findMatchingMemberIds(tenantId: string, orConditions: Record<string, unknown>[]) {
    const { Member } = await import('../models/Member');
    const matches = await Member.find({ tenantId, $or: orConditions }).select('_id').lean();
    return matches.map((m) => m._id);
  }

  static async findMatchingReceiptIds(tenantId: string, regex: RegExp) {
    const matches = await Receipt.find({ tenantId, receiptNo: regex }).select('_id').lean();
    return matches.map((r) => r._id);
  }

  static async findDueFamilies(filter: Record<string, unknown>) {
    const { Family } = await import('../models/Family');
    return Family.find(filter).populate('headMemberId', 'name phone').lean();
  }

  static async findMatchingFamilyIds(tenantId: string, orConditions: Record<string, unknown>[]) {
    const { Family } = await import('../models/Family');
    const matches = await Family.find({ tenantId, $or: orConditions }).select('_id').lean();
    return matches.map((f) => f._id);
  }

  static async findDonationsFiltered(filter: Record<string, unknown>) {
    const { Donation } = await import('../models/Donation');
    return Donation.find(filter)
      .populate('donorId', 'name phone')
      .populate({
        path: 'familyId',
        select: 'familyCode headMemberId',
        populate: { path: 'headMemberId', select: 'name phone' },
      })
      .populate('receiptId', 'receiptNo')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async distinctPaymentTypes(tenantId: string) {
    return Payment.distinct('type', { tenantId });
  }

  static async distinctDonationCampaigns(tenantId: string) {
    const { Donation } = await import('../models/Donation');
    return Donation.distinct('campaign', { tenantId });
  }

  static async distinctDonationPurposes(tenantId: string) {
    const { Donation } = await import('../models/Donation');
    return Donation.distinct('purpose', { tenantId });
  }

  static async findAllPaginated(filter: Record<string, unknown>, skip: number, limit: number) {
    return Payment.find(filter).populate('paidById paidForId', 'name phone').sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  static async count(filter: Record<string, unknown>) {
    return Payment.countDocuments(filter);
  }
}

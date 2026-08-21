import { Donation } from '../models/Donation';
import { Family } from '../models/Family';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { Payment } from '../models/Payment';
import { Receipt } from '../models/Receipt';

export class DonationRepository {
  static async findAll(filter: Record<string, unknown>, skip: number, limit: number) {
    return Donation.find(filter)
      .populate('donorId', 'name phone')
      .populate({
        path: 'familyId',
        select: 'familyCode headMemberId',
        populate: { path: 'headMemberId', select: 'name' },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async count(filter: Record<string, unknown>) {
    return Donation.countDocuments(filter);
  }

  static async create(data: Record<string, unknown>) {
    return Donation.create(data);
  }

  static async insertMany(data: Record<string, unknown>[]) {
    return Donation.insertMany(data);
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Donation.findOne({ _id: id, tenantId });
  }

  static async findAllFamiliesByTenant(tenantId: string) {
    return Family.find({ tenantId }).lean();
  }

  static async incrementFamilyBalanceForAllInTenant(tenantId: string, amount: number) {
    await Family.updateMany({ tenantId }, { $inc: { outstandingBalance: amount } });
  }

  static async incrementFamilyBalanceByIdAndTenant(id: string, tenantId: string, amount: number) {
    return Family.findOneAndUpdate({ _id: id, tenantId }, { $inc: { outstandingBalance: amount } }, { new: true });
  }

  // No tenantId filter — matches the original code's inconsistent scoping
  // exactly (family lookups here were never tenant-scoped, unlike the
  // increment above).
  static async findFamilyByIdRaw(id: string) {
    return Family.findById(id).lean();
  }

  static async incrementFamilyBalanceById(id: string, amount: number) {
    await Family.findByIdAndUpdate(id, { $inc: { outstandingBalance: amount } });
  }

  static async findUsersByTenantAndMemberIds(tenantId: string, memberIds: unknown[]) {
    return User.find({ tenantId, memberId: { $in: memberIds } }).select('_id').lean();
  }

  static async findUserByTenantAndMemberId(tenantId: string, memberId: unknown) {
    return User.findOne({ memberId, tenantId });
  }

  static async createNotification(data: Record<string, unknown>) {
    return Notification.create(data);
  }

  static async insertManyNotifications(data: Record<string, unknown>[]) {
    await Notification.insertMany(data);
  }

  static async countPayments(tenantId: string) {
    return Payment.countDocuments({ tenantId });
  }

  static async createPayment(data: Record<string, unknown>) {
    return Payment.create(data);
  }

  static async countReceipts(tenantId: string) {
    return Receipt.countDocuments({ tenantId });
  }

  static async createReceipt(data: Record<string, unknown>) {
    return Receipt.create(data);
  }

  static async setPaymentReceiptId(paymentId: unknown, receiptId: unknown) {
    await Payment.findByIdAndUpdate(paymentId, { receiptId });
  }
}

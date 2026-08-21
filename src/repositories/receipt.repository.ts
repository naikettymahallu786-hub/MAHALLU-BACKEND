import { Receipt } from '../models/Receipt';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { Member } from '../models/Member';
import { Family } from '../models/Family';

const PAYMENT_POPULATE = {
  path: 'paymentId',
  populate: [
    { path: 'paidForId', select: 'name phone' },
    { path: 'paidById', select: 'name phone' },
  ],
};

export class ReceiptRepository {
  static async findAllByTenant(tenantId: string) {
    return Receipt.find({ tenantId }).populate(PAYMENT_POPULATE).sort({ createdAt: -1 }).lean();
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Receipt.findOne({ _id: id, tenantId }).populate(PAYMENT_POPULATE).lean();
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

  static async create(data: Record<string, unknown>) {
    return Receipt.create(data);
  }

  static async setPaymentReceiptId(paymentId: unknown, receiptId: unknown) {
    await Payment.findByIdAndUpdate(paymentId, { receiptId });
  }

  static async findFamilyHeadMemberId(familyId: unknown, tenantId: string) {
    return Family.findOne({ _id: familyId, tenantId }).select('headMemberId').lean();
  }

  static async findUserMemberId(userId: string) {
    return User.findById(userId).select('memberId').lean();
  }

  static async findAnyMemberInTenant(tenantId: string) {
    return Member.findOne({ tenantId }).select('_id').lean();
  }
}

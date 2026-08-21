import mongoose from 'mongoose';
import { ReceiptRepository } from '../repositories/receipt.repository';
import { generateSequentialId } from '../domain/idGenerator';
import { processPaymentDues } from './paymentAllocation.service';

function extractId(val: any) {
  if (!val) return null;
  const idStr = typeof val === 'object' ? val._id || val.id : val;
  return mongoose.Types.ObjectId.isValid(String(idStr)) ? idStr : null;
}

export class ReceiptService {
  static async getAll(tenantId: string) {
    return ReceiptRepository.findAllByTenant(tenantId);
  }

  static async getById(id: string, tenantId: string) {
    return ReceiptRepository.findByIdAndTenant(id, tenantId);
  }

  static async createManual(
    tenantId: string,
    userId: string,
    body: {
      amount?: number;
      type?: string;
      paidById?: unknown;
      paidForId?: unknown;
      description?: string;
      gateway?: string;
      familyId?: string;
    },
  ) {
    const { amount, type, paidById, paidForId, description, gateway = 'cash', familyId } = body;

    const count = await ReceiptRepository.countPayments(tenantId);
    const paymentNo = generateSequentialId('PAY', count, { padWidth: 6 });

    // Resolve who is paying: explicit paidById/paidForId -> family head ->
    // current user's own member -> any member in the tenant (last resort).
    let payerId = extractId(paidById) || extractId(paidForId);
    if (!payerId && familyId) {
      const fam = await ReceiptRepository.findFamilyHeadMemberId(familyId, tenantId);
      if (fam?.headMemberId) payerId = extractId(fam.headMemberId);
    }

    if (!payerId) {
      const u = await ReceiptRepository.findUserMemberId(userId);
      if (u?.memberId) payerId = u.memberId;
    }

    if (!payerId) {
      const fallbackMember = await ReceiptRepository.findAnyMemberInTenant(tenantId);
      if (fallbackMember) payerId = fallbackMember._id;
    }

    const targetId = extractId(paidForId) || payerId;
    const numAmount = Number(amount || 0);

    const payment = await ReceiptRepository.createPayment({
      tenantId,
      paymentNo,
      type: type || 'recurring_donation',
      amount: numAmount,
      paidById: payerId,
      paidForId: targetId,
      metadata: familyId ? { familyId } : undefined,
      gateway: String(gateway || 'cash').toLowerCase(),
      status: 'completed',
      description,
    });

    const paymentObj: any = payment.toObject();
    if (familyId) paymentObj.familyId = familyId;

    const receiptCount = await ReceiptRepository.countReceipts(tenantId);
    const receiptNo = generateSequentialId('RCP', receiptCount, { padWidth: 6 });
    const receipt = await ReceiptRepository.create({ tenantId, receiptNo, paymentId: payment._id });
    await ReceiptRepository.setPaymentReceiptId(payment._id, receipt._id);

    // Process family balance and recurring dues
    await processPaymentDues(paymentObj);

    return { payment, receipt };
  }
}

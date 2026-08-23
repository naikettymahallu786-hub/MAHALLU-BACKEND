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
    const receipts = await ReceiptRepository.findAllByTenant(tenantId);
    const { User } = await import('../models/User');

    return Promise.all(
      receipts.map(async (r: any) => {
        const payment = r.paymentId;
        if (!payment) return r;

        let name = '';
        if (payment.metadata?.donorName) {
          name = payment.metadata.donorName;
        } else if (r.metadata?.donorName) {
          name = r.metadata.donorName;
        } else if (payment.description?.includes('(Donor: ')) {
          const match = payment.description.match(/\(Donor:\s*([^,)]+)/);
          if (match) name = match[1].trim();
        } else if (payment.metadata?.name) {
          name = payment.metadata.name;
        } else if (payment.paidForId?.name && !payment.metadata?.isExternalDonor) {
          name = payment.paidForId.name;
        } else if (payment.paidById?.name && !payment.metadata?.isExternalDonor) {
          name = payment.paidById.name;
        } else if (payment.paidById) {
          const u = await User.findById(payment.paidById).select('name phone').lean();
          if (u) name = u.name;
        }

        if (!name) {
          name = 'Mahallu Contributor';
        }

        if (payment.paidById) {
          payment.paidById = {
            ...(typeof payment.paidById === 'object' ? payment.paidById : {}),
            name: name,
            phone: payment.metadata?.donorPhone || payment.paidById?.phone,
          };
        }
        return r;
      }),
    );
  }

  static async getById(id: string, tenantId: string) {
    const receipt: any = await ReceiptRepository.findByIdAndTenant(id, tenantId);
    if (!receipt) return null;

    const payment = receipt.paymentId;
    if (payment) {
      const { User } = await import('../models/User');
      let name = '';
      if (payment.metadata?.donorName) {
        name = payment.metadata.donorName;
      } else if (receipt.metadata?.donorName) {
        name = receipt.metadata.donorName;
      } else if (payment.description?.includes('(Donor: ')) {
        const match = payment.description.match(/\(Donor:\s*([^,)]+)/);
        if (match) name = match[1].trim();
      } else if (payment.metadata?.name) {
        name = payment.metadata.name;
      } else if (payment.paidForId?.name && !payment.metadata?.isExternalDonor) {
        name = payment.paidForId.name;
      } else if (payment.paidById?.name && !payment.metadata?.isExternalDonor) {
        name = payment.paidById.name;
      } else if (payment.paidById) {
        const u = await User.findById(payment.paidById).select('name phone').lean();
        if (u) name = u.name;
      }

      if (!name) {
        name = 'Mahallu Contributor';
      }

      if (payment.paidById) {
        payment.paidById = {
          ...(typeof payment.paidById === 'object' ? payment.paidById : {}),
          name: name,
          phone: payment.metadata?.donorPhone || payment.paidById?.phone,
        };
      }
    }
    return receipt;
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
    const { amount, type, paidById, paidForId, description, gateway = 'cash', familyId, donorName, donorPhone, category } = body as any;

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

    const isExternal = Boolean(donorName) || !paidById;
    const meta: Record<string, any> = {};
    if (familyId) meta.familyId = familyId;
    if (category) meta.category = category;
    if (donorName) meta.donorName = donorName;
    if (donorPhone) meta.donorPhone = donorPhone;
    if (isExternal) meta.isExternalDonor = true;

    const payment = await ReceiptRepository.createPayment({
      tenantId,
      paymentNo,
      type: type || 'recurring_donation',
      amount: numAmount,
      paidById: payerId,
      paidForId: targetId,
      metadata: Object.keys(meta).length > 0 ? meta : undefined,
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

import { DonationRepository } from '../repositories/donation.repository';
import { buildPaginationMeta } from '../domain/pagination';
import { generateSequentialId } from '../domain/idGenerator';
import { NotificationChannel } from "../types";

export class DonationService {
  static async getAll(tenantId: string, query: { page?: string; limit?: string; campaign?: string }) {
    const { page = '1', limit = '20', campaign } = query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const filter: Record<string, unknown> = { tenantId };
    if (campaign) filter.campaign = campaign;

    const [donations, total] = await Promise.all([
      DonationRepository.findAll(filter, (pageNum - 1) * limitNum, limitNum),
      DonationRepository.count(filter),
    ]);

    return { donations, pagination: buildPaginationMeta(pageNum, limitNum, total) };
  }

  static async create(
    tenantId: string,
    userId: string,
    body: {
      amount: number;
      campaign?: string;
      familyId?: string;
      donorName?: string;
      isAnonymous?: boolean;
      gateway?: string;
      selectAllFamilies?: boolean;
    },
  ) {
    const { amount, campaign, familyId, donorName, isAnonymous, gateway, selectAllFamilies } = body;
    const isFamilyDue = !!familyId && familyId !== 'all_families' && !gateway;

    if (familyId === 'all_families' || selectAllFamilies) {
      return this.createForAllFamilies(tenantId, { amount, campaign, donorName, isAnonymous, gateway });
    }

    const d = await DonationRepository.create({
      tenantId,
      amount,
      campaign,
      familyId: familyId || undefined,
      donorName,
      isAnonymous,
      status: isFamilyDue ? 'pending' : 'paid',
    });

    if (isFamilyDue) {
      const family = await DonationRepository.incrementFamilyBalanceByIdAndTenant(familyId!, tenantId, amount);

      if (family && family.headMemberId) {
        const headUser = await DonationRepository.findUserByTenantAndMemberId(tenantId, family.headMemberId);

        if (headUser) {
          await DonationRepository.createNotification({
            tenantId,
            channel: NotificationChannel.IN_APP,
            recipientId: headUser._id,
            title: 'New Due Added',
            body: `A new due of ${amount} for ${campaign || 'General Donation'} has been added to your family account. Please pay at your earliest convenience.`,
            status: 'pending',
          });
        }
      }
    } else if (gateway) {
      // If payment is collected immediately (Cash / GPay)
      const count = await DonationRepository.countPayments(tenantId);
      const paymentNo = generateSequentialId('PAY', count, { padWidth: 6 });

      // Resolve who is paying
      let paidById: any = userId; // Default to admin recording it
      if (familyId) {
        const family = await DonationRepository.findFamilyByIdRaw(familyId);
        if (family && family.headMemberId) {
          paidById = family.headMemberId;
        }
      }

      const payment = await DonationRepository.createPayment({
        tenantId,
        paymentNo,
        type: 'donation',
        amount,
        paidById,
        paidForId: familyId ? paidById : undefined,
        gateway: gateway.toLowerCase(),
        status: 'success',
        description: campaign || 'Direct Donation',
      });

      const receiptCount = await DonationRepository.countReceipts(tenantId);
      const receiptNo = generateSequentialId('RCP', receiptCount, { padWidth: 6 });
      const receipt = await DonationRepository.createReceipt({ tenantId, receiptNo, paymentId: payment._id });
      await DonationRepository.setPaymentReceiptId(payment._id, receipt._id);

      // Link donation to payment
      d.paymentId = payment._id as any;
      await d.save();
    }

    return d;
  }

  private static async createForAllFamilies(
    tenantId: string,
    body: { amount: number; campaign?: string; donorName?: string; isAnonymous?: boolean; gateway?: string },
  ) {
    const { amount, campaign, donorName, isAnonymous, gateway } = body;
    const allFamilies = await DonationRepository.findAllFamiliesByTenant(tenantId);
    const isBulkFamilyDue = !gateway;

    const donationsToCreate = allFamilies.map((f: any) => ({
      tenantId,
      amount,
      campaign: campaign || 'General Donation',
      familyId: f._id,
      donorName: donorName || f.familyCode,
      isAnonymous: !!isAnonymous,
      status: isBulkFamilyDue ? 'pending' : 'paid',
    }));

    const createdDonations = await DonationRepository.insertMany(donationsToCreate);

    if (isBulkFamilyDue) {
      await DonationRepository.incrementFamilyBalanceForAllInTenant(tenantId, amount);

      const headIds = allFamilies.map((f: any) => f.headMemberId).filter(Boolean);
      const headUsers = await DonationRepository.findUsersByTenantAndMemberIds(tenantId, headIds);

      if (headUsers.length > 0) {
        const notifications = headUsers.map((u: any) => ({
          tenantId,
          channel: NotificationChannel.IN_APP,
          recipientId: u._id,
          title: 'New Donation Due Added',
          body: `A new due of ${amount} for ${campaign || 'General Donation'} has been assigned to your family account.`,
          status: 'pending',
        }));
        await DonationRepository.insertManyNotifications(notifications);
      }
    }

    return {
      message: `Successfully assigned donation to all ${allFamilies.length} families.`,
      data: createdDonations,
    };
  }

  // Not-found/already-paid checks return here rather than throwing AppError
  // — the controller inspects the discriminated result and builds the same
  // raw res.status(...) responses the original inline handler did.
  static async collect(
    id: string,
    tenantId: string,
    userId: string,
    body: { gateway?: string; amount?: number; description?: string },
  ): Promise<
    | { outcome: 'not_found' }
    | { outcome: 'already_paid' }
    | { outcome: 'collected'; donation: unknown; payment: unknown; receipt: unknown }
  > {
    const { gateway = 'cash', amount, description } = body;

    const donation = await DonationRepository.findByIdAndTenant(id, tenantId);
    if (!donation) {
      return { outcome: 'not_found' };
    }

    if (donation.status === 'paid' || !donation.status) {
      return { outcome: 'already_paid' };
    }

    const collectAmount = amount || donation.amount;

    const count = await DonationRepository.countPayments(tenantId);
    const paymentNo = generateSequentialId('PAY', count, { padWidth: 6 });

    // Resolve who is paying
    let paidById: any = userId;
    if (donation.familyId) {
      const family = await DonationRepository.findFamilyByIdRaw(String(donation.familyId));
      if (family && family.headMemberId) {
        paidById = family.headMemberId;
      }
    } else if (donation.donorId) {
      paidById = donation.donorId;
    }

    const payment = await DonationRepository.createPayment({
      tenantId,
      paymentNo,
      type: 'donation',
      amount: collectAmount,
      paidById,
      paidForId: donation.familyId ? paidById : undefined,
      gateway: gateway.toLowerCase(),
      status: 'success',
      description: description || donation.campaign || 'Collected Donation Dues',
    });

    const receiptCount = await DonationRepository.countReceipts(tenantId);
    const receiptNo = generateSequentialId('RCP', receiptCount, { padWidth: 6 });
    const receipt = await DonationRepository.createReceipt({ tenantId, receiptNo, paymentId: payment._id });
    await DonationRepository.setPaymentReceiptId(payment._id, receipt._id);

    donation.status = 'paid';
    donation.paymentId = payment._id as any;
    await donation.save();

    if (donation.familyId) {
      await DonationRepository.incrementFamilyBalanceById(String(donation.familyId), -collectAmount);
    }

    return { outcome: 'collected', donation, payment, receipt };
  }
}

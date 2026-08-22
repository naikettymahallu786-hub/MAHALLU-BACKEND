import crypto from 'crypto';
import Razorpay from 'razorpay';
import { AppError } from '../middleware/errorHandler';
import { PaymentRepository } from '../repositories/payment.repository';
import { processPaymentDues } from './paymentAllocation.service';
import { generateSequentialId } from '../domain/idGenerator';
import { buildCSV } from '../domain/csvExport';
import { computeDateRange } from '../domain/dateRangeQuery';
import { PaymentStatus } from "../types";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../config/constants";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TEgC71zlAgHt9w',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'Q7eUlKyyGO7dV2JRpyU1N0sP',
});

function escapeSearchRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class PaymentService {
  static async verify(body: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    paymentId: string;
  }) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = body;
    const signatureBody = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'Q7eUlKyyGO7dV2JRpyU1N0sP')
      .update(signatureBody)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new AppError('Invalid payment signature', 400);
    }

    const payment = await PaymentRepository.findByIdAndUpdateStatus(paymentId, {
      status: PaymentStatus.SUCCESS,
      gatewayPaymentId: razorpay_payment_id,
      gatewaySignature: razorpay_signature,
    });

    if (payment) {
      const count = await PaymentRepository.countReceipts(payment.tenantId);
      const receiptNo = generateSequentialId('RCP', count, { padWidth: 6 });
      const receipt = await PaymentRepository.createReceipt({ tenantId: payment.tenantId, receiptNo, paymentId: payment._id });
      await PaymentRepository.setPaymentReceiptId(payment._id, receipt._id);

      await processPaymentDues(payment);
    }

    return payment;
  }

  static async getFinanceReport(
    tenantId: string,
    query: {
      search?: string;
      paymentStatus?: string;
      category?: string;
      gateway?: string;
      startDate?: string;
      endDate?: string;
      month?: string;
      year?: string;
      page?: string;
      limit?: string;
      format?: string;
    },
  ) {
    const {
      search,
      paymentStatus = 'all',
      category = 'all',
      gateway = 'all',
      startDate,
      endDate,
      month,
      year,
      page = '1',
      limit = '20',
      format = 'json',
    } = query;

    const filter: Record<string, any> = { tenantId, isDeleted: { $ne: true } };

    if (category && category !== 'all') {
      const cleanCat = String(category).trim();
      const catRegex = new RegExp(escapeSearchRegex(cleanCat), 'i');
      filter.$or = [{ type: category }, { type: catRegex }, { description: catRegex }];
    }

    if (paymentStatus && paymentStatus !== 'all') {
      if (paymentStatus === 'completed' || paymentStatus === 'success' || paymentStatus === 'paid') {
        filter.status = { $in: ['completed', 'success', 'paid', 'COMPLETED', 'SUCCESS', 'PAID'] };
      } else if (paymentStatus === 'pending' || paymentStatus === 'unpaid') {
        filter.status = { $in: ['pending', 'unpaid', 'PENDING', 'UNPAID'] };
      } else {
        filter.status = paymentStatus;
      }
    }

    if (gateway && gateway !== 'all') {
      filter.gateway = gateway;
    }

    const createdAtFilter = computeDateRange(startDate, endDate, month, year);
    if (createdAtFilter) {
      filter.createdAt = createdAtFilter;
    }

    if (search) {
      const cleanSearch = String(search).trim();
      const searchRegex = new RegExp(escapeSearchRegex(cleanSearch), 'i');

      const memberIds = await PaymentRepository.findMatchingMemberIds(tenantId, [{ name: searchRegex }, { phone: searchRegex }]);
      const receiptIds = await PaymentRepository.findMatchingReceiptIds(tenantId, searchRegex);

      filter.$or = [
        { paymentNo: searchRegex },
        { description: searchRegex },
        { paidById: { $in: memberIds } },
        { paidForId: { $in: memberIds } },
        { receiptId: { $in: receiptIds } },
      ];
    }

    const payments = await PaymentRepository.findFilteredWithPopulate(filter);

    const paymentItems = payments.map((p: any) => {
      const payer = p.paidById;
      const receipt = p.receiptId;
      const rawStatus = String(p.status || '').toLowerCase();
      const normalizedStatus =
        rawStatus === 'success' || rawStatus === 'paid' || rawStatus === 'completed'
          ? 'completed'
          : rawStatus === 'failed'
          ? 'failed'
          : 'pending';

      return {
        _id: p._id,
        paymentNo: p.paymentNo,
        receiptNo: receipt?.receiptNo || 'N/A',
        payerName: payer?.name || 'N/A',
        payerPhone: payer?.phone || 'N/A',
        category: p.type,
        amount: p.amount || 0,
        gateway: p.gateway,
        status: normalizedStatus,
        description: p.description || '',
        createdAt: p.createdAt,
      };
    });

    // Include Unpaid / Overdue Family Recurring Dues
    const shouldIncludeDues =
      (paymentStatus === 'all' || paymentStatus === 'unpaid' || paymentStatus === 'overdue' || paymentStatus === 'pending') &&
      (category === 'all' || category === 'recurring_donation');

    let duesItems: any[] = [];
    if (shouldIncludeDues) {
      const familyFilter: Record<string, any> = {
        tenantId,
        isDeleted: { $ne: true },
        recurringDonationType: { $in: ['monthly', 'yearly'] },
        outstandingBalance: { $gt: 0 },
      };

      if (search) {
        const cleanSearch = String(search).trim();
        const searchRegex = new RegExp(escapeSearchRegex(cleanSearch), 'i');
        const memberIds = await PaymentRepository.findMatchingMemberIds(tenantId, [{ name: searchRegex }, { phone: searchRegex }]);

        familyFilter.$or = [
          { familyCode: searchRegex },
          { 'address.line1': searchRegex },
          { wardNo: searchRegex },
          { headMemberId: { $in: memberIds } },
        ];
      }

      const dueFamilies = await PaymentRepository.findDueFamilies(familyFilter);
      const today = new Date();

      duesItems = dueFamilies.map((f: any) => {
        const head = f.headMemberId;
        const nextDue = f.nextPaymentDueDate ? new Date(f.nextPaymentDueDate) : null;
        const isOverdue = nextDue && nextDue < today;

        return {
          _id: `due_${f._id}`,
          paymentNo: `DUE-${f.familyCode}`,
          receiptNo: 'UNPAID',
          payerName: `${head?.name || 'N/A'} (${f.familyCode})`,
          payerPhone: head?.phone || 'N/A',
          category: 'recurring_donation',
          amount: f.outstandingBalance || 0,
          gateway: 'unpaid_due',
          status: isOverdue ? 'overdue' : 'unpaid',
          description: `Recurring ${f.recurringDonationType} dues for Ward ${f.wardNo || 'N/A'}`,
          createdAt: f.nextPaymentDueDate || f.updatedAt || new Date(),
        };
      });

      if (paymentStatus === 'overdue') {
        duesItems = duesItems.filter((i) => i.status === 'overdue');
      }
    }

    // Include Donation collection records
    let donationItems: any[] = [];
    {
      const donationFilter: Record<string, any> = { tenantId };

      if (paymentStatus === 'completed') {
        donationFilter.status = 'paid';
      } else if (paymentStatus === 'pending' || paymentStatus === 'unpaid') {
        donationFilter.status = 'pending';
      } else if (paymentStatus === 'overdue') {
        donationFilter.status = 'pending';
      }

      if (createdAtFilter) {
        donationFilter.createdAt = createdAtFilter;
      }

      if (category && category !== 'all') {
        donationFilter.$or = [{ campaign: category }, { purpose: category }];
      }

      if (search) {
        const cleanSearch = String(search).trim();
        const searchRegex = new RegExp(escapeSearchRegex(cleanSearch), 'i');

        const memberIds = await PaymentRepository.findMatchingMemberIds(tenantId, [{ name: searchRegex }, { phone: searchRegex }]);
        const familyIds = await PaymentRepository.findMatchingFamilyIds(tenantId, [
          { familyCode: searchRegex },
          { headMemberId: { $in: memberIds } },
        ]);

        donationFilter.$or = [
          { campaign: searchRegex },
          { donorName: searchRegex },
          { donorId: { $in: memberIds } },
          { familyId: { $in: familyIds } },
        ];
      }

      const donations = await PaymentRepository.findDonationsFiltered(donationFilter);

      const existingPaymentIds = new Set(payments.map((p: any) => String(p._id)));

      donationItems = donations
        .filter((d: any) => !d.paymentId || !existingPaymentIds.has(String(d.paymentId)))
        .map((d: any) => {
          const head = d.familyId?.headMemberId;
          const donor = d.donorId;
          const isPaid = d.status === 'paid';
          return {
            _id: `donation_${d._id}`,
            paymentNo: `DON-${String(d._id).slice(-6).toUpperCase()}`,
            receiptNo: d.receiptId?.receiptNo || (isPaid ? 'PAID' : 'UNPAID'),
            payerName: d.isAnonymous
              ? 'Anonymous'
              : d.familyId
              ? `${head?.name || 'Family Head'} (${d.familyId.familyCode})`
              : donor?.name || d.donorName || 'General Donor',
            payerPhone: donor?.phone || head?.phone || 'N/A',
            category: d.campaign || d.purpose || 'donation',
            amount: d.amount || 0,
            gateway: isPaid ? 'direct' : 'pending_due',
            status: isPaid ? 'completed' : 'pending',
            description: `Donation campaign: ${d.campaign || 'General Sadaqah'}`,
            createdAt: d.createdAt,
          };
        });
    }

    const items = [...paymentItems, ...duesItems, ...donationItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const completedPayments = items.filter((i) => i.status === 'completed');
    const totalIncome = completedPayments.reduce((sum, i) => sum + i.amount, 0);
    const pendingDuesAmount = items
      .filter((i) => i.status === 'pending' || i.status === 'unpaid' || i.status === 'overdue')
      .reduce((sum, i) => sum + i.amount, 0);

    const summary = {
      totalTransactions: items.length,
      totalIncome,
      pendingAmount: pendingDuesAmount,
      completedCount: completedPayments.length,
      unpaidCount: items.filter((i) => i.status === 'unpaid' || i.status === 'overdue' || i.status === 'pending').length,
      overdueCount: items.filter((i) => i.status === 'overdue').length,
      failedCount: items.filter((i) => i.status === 'failed').length,
      avgTransaction: completedPayments.length > 0 ? Math.round(totalIncome / completedPayments.length) : 0,
    };

    if (format === 'csv') {
      const headers = ['Receipt No', 'Payment No', 'Date', 'Payer Name', 'Phone', 'Category', 'Amount (INR)', 'Method', 'Status', 'Description'];
      const rows = items.map((item) => [
        item.receiptNo,
        item.paymentNo,
        new Date(item.createdAt).toISOString().split('T')[0],
        item.payerName,
        item.payerPhone,
        item.category,
        item.amount,
        item.gateway,
        item.status,
        item.description,
      ]);
      return {
        format: 'csv' as const,
        content: buildCSV(headers, rows),
        filename: `full_finance_report_${Date.now()}.csv`,
      };
    }

    const pageNum = parseInt(page) || 1;
    const isAllLimit = limit === 'all' || limit === '0';
    const limitNum = isAllLimit ? items.length : parseInt(limit) || 20;
    const total = items.length;
    const totalPages = isAllLimit || total === 0 ? 1 : Math.ceil(total / limitNum);

    const paginatedItems = isAllLimit ? items : items.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const [distinctPaymentTypes, distinctDonationCampaigns, distinctDonationPurposes] = await Promise.all([
      PaymentRepository.distinctPaymentTypes(tenantId),
      PaymentRepository.distinctDonationCampaigns(tenantId),
      PaymentRepository.distinctDonationPurposes(tenantId),
    ]);

    const defaultCategories = [
      'General Sadaqah',
      'Recurring Donation',
      'Mosque Renovation',
      'Orphan Support',
      'Madrasa Fund',
      'Property Rent',
      'Certificate Fee',
      'Nikah Fee',
      'donation',
    ];

    const availableCategories = Array.from(
      new Set(
        [...defaultCategories, ...distinctPaymentTypes.filter(Boolean), ...distinctDonationCampaigns.filter(Boolean), ...distinctDonationPurposes.filter(Boolean)].map(
          (c: string) => String(c).trim(),
        ),
      ),
    )
      .filter(Boolean)
      .sort();

    return {
      format: 'json' as const,
      data: {
        summary,
        items: paginatedItems,
        categories: availableCategories,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasPrev: pageNum > 1,
          hasNext: pageNum < totalPages,
        },
      },
    };
  }

  static async createOrder(
    tenantId: string,
    userId: string,
    userRole: string,
    body: { amount: number; type: string; paidForId?: string; description?: string; gateway?: string },
  ) {
    const userPermissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];
    const hasAccess = userPermissions.includes(PERMISSIONS.PAYMENT_CREATE) || userPermissions.includes(PERMISSIONS.PAYMENT_SELF);

    if (!hasAccess) {
      throw new AppError('Insufficient permissions', 403);
    }

    const { amount, type, paidForId, description, gateway = 'razorpay' } = body;

    const count = await PaymentRepository.countPayments(tenantId);
    const paymentNo = generateSequentialId('PAY', count, { padWidth: 6 });

    const { User } = await import('../models/User');
    const { Member } = await import('../models/Member');

    // Resolve actual Member ID for the paying user
    const userDoc = await User.findById(userId).lean();
    let payerMemberId = userDoc?.memberId;
    if (!payerMemberId) {
      const matchingMember = await Member.findOne({
        tenantId,
        $or: [
          ...(userDoc?.phone ? [{ phone: userDoc.phone }] : []),
          ...(userDoc?.email ? [{ email: userDoc.email }] : []),
        ],
      }).select('_id').lean();
      if (matchingMember) {
        payerMemberId = matchingMember._id as any;
      }
    }

    let targetMemberId = paidForId;
    if (targetMemberId) {
      const targetUser = await User.findById(targetMemberId).lean();
      if (targetUser?.memberId) {
        targetMemberId = String(targetUser.memberId);
      }
    } else {
      targetMemberId = payerMemberId ? String(payerMemberId) : undefined;
    }

    const fallbackMember = !payerMemberId ? await Member.findOne({ tenantId }).select('_id').lean() : null;
    const finalPaidById = payerMemberId || fallbackMember?._id;
    const finalPaidForId = targetMemberId || finalPaidById;

    const donorInfo = {
      donorName: userDoc?.name || 'Mahallu Donor',
      donorPhone: userDoc?.phone || '',
      donorEmail: userDoc?.email || '',
    };

    if (gateway === 'cash' || gateway === 'bank_transfer' || gateway === 'upi') {
      const payment = await PaymentRepository.createPayment({
        tenantId,
        paymentNo,
        type,
        amount,
        paidById: finalPaidById,
        paidForId: finalPaidForId,
        gateway,
        status: PaymentStatus.SUCCESS,
        description,
        metadata: donorInfo,
      });

      const receiptCount = await PaymentRepository.countReceipts(tenantId);
      const receiptNo = generateSequentialId('RCP', receiptCount, { padWidth: 6 });
      const receipt = await PaymentRepository.createReceipt({ tenantId, receiptNo, paymentId: payment._id });
      await PaymentRepository.setPaymentReceiptId(payment._id, receipt._id);

      await processPaymentDues(payment);

      return { immediate: true as const, payment, receipt };
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { tenantId, type, paidForId: finalPaidForId, description } as any,
    });

    const payment = await PaymentRepository.createPayment({
      tenantId,
      paymentNo,
      type,
      amount,
      paidById: finalPaidById,
      paidForId: finalPaidForId,
      gateway: 'razorpay',
      gatewayOrderId: order.id,
      status: 'pending',
      description,
      metadata: donorInfo,
    });

    return { immediate: false as const, order, payment };
  }

  static async getAll(tenantId: string, query: { page?: string; limit?: string; type?: string; status?: string }) {
    const { page = '1', limit = '20', type, status } = query;
    const filter: Record<string, unknown> = { tenantId };
    if (type) filter.type = type;
    if (status) filter.status = status;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const [payments, total] = await Promise.all([
      PaymentRepository.findAllPaginated(filter, (pageNum - 1) * limitNum, limitNum),
      PaymentRepository.count(filter),
    ]);

    return {
      payments,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    };
  }
}

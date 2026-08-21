import QRCode from 'qrcode';
import { AppError } from '../middleware/errorHandler';
import { FamilyRepository } from '../repositories/family.repository';
import { calculateNextDueDate } from '../domain/billing';
import { generateSequentialId } from '../domain/idGenerator';
import { buildPaginationMeta } from '../domain/pagination';
import { buildCSV } from '../domain/csvExport';
import { computeDateRange } from '../domain/dateRangeQuery';
import { NotificationChannel } from '@mahallu/shared-types';

function escapeSearchRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class FamilyService {
  static async getRecurringReport(
    tenantId: string,
    query: {
      search?: string;
      paymentStatus?: string;
      recurringType?: string;
      startDate?: string;
      endDate?: string;
      month?: string;
      year?: string;
      format?: string;
    },
  ) {
    const {
      search,
      paymentStatus = 'all',
      recurringType = 'all',
      startDate,
      endDate,
      month,
      year,
      format = 'json',
    } = query;

    const filter: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      recurringDonationType: { $in: ['monthly', 'yearly'] },
    };

    if (recurringType && recurringType !== 'all') {
      filter.recurringDonationType = recurringType;
    }

    if (search) {
      const cleanSearch = String(search).trim();
      const searchRegex = new RegExp(escapeSearchRegex(cleanSearch), 'i');

      const memberIds = await FamilyRepository.findMatchingMemberIds(tenantId, [
        { name: searchRegex },
        { phone: searchRegex },
      ]);

      filter.$or = [
        { familyCode: searchRegex },
        { 'address.line1': searchRegex },
        { wardNo: searchRegex },
        { headMemberId: { $in: memberIds } },
        { 'members.memberId': { $in: memberIds } },
      ];
    }

    // Handle Date Filtering (month, year, date ranges) — same computation
    // as domain/dateRangeQuery.ts's computeDateRange, applied across 3
    // fields via $or rather than a single field.
    const dateRangeFilter = computeDateRange(startDate, endDate, month, year);

    if (dateRangeFilter) {
      filter.$or = [
        { nextPaymentDueDate: dateRangeFilter },
        { lastPaymentDate: dateRangeFilter },
        { updatedAt: dateRangeFilter },
      ];
    }

    const families = await FamilyRepository.findAllByFilterSorted(filter);

    const today = new Date();

    const items = families.map((f: any) => {
      const head = f.headMemberId;
      const outstanding = f.outstandingBalance || 0;
      const amount = f.recurringDonationAmount || 0;
      const nextDue = f.nextPaymentDueDate ? new Date(f.nextPaymentDueDate) : null;

      let status = 'PAID';
      if (outstanding > 0) {
        if (nextDue && nextDue < today) {
          status = 'OVERDUE';
        } else {
          status = 'UNPAID';
        }
      }

      return {
        _id: f._id,
        familyCode: f.familyCode,
        headName: head?.name || 'N/A',
        headPhone: head?.phone || 'N/A',
        wardNo: f.wardNo || 'N/A',
        address: f.address?.line1 || 'N/A',
        recurringType: f.recurringDonationType || 'none',
        recurringAmount: amount,
        outstandingBalance: outstanding,
        lastPaymentDate: f.lastPaymentDate || null,
        nextPaymentDueDate: f.nextPaymentDueDate || null,
        status,
      };
    });

    const filteredItems = items.filter((item) => {
      if (paymentStatus === 'paid') return item.status === 'PAID';
      if (paymentStatus === 'unpaid') return item.status === 'UNPAID' || item.status === 'OVERDUE';
      if (paymentStatus === 'overdue') return item.status === 'OVERDUE';
      if (paymentStatus === 'pending') return item.status === 'UNPAID' || item.status === 'OVERDUE';
      return true;
    });

    const summary = {
      totalCount: filteredItems.length,
      totalExpected: filteredItems.reduce((acc, i) => acc + i.recurringAmount, 0),
      totalOutstanding: filteredItems.reduce((acc, i) => acc + i.outstandingBalance, 0),
      paidCount: filteredItems.filter((i) => i.status === 'PAID').length,
      unpaidCount: filteredItems.filter((i) => i.status === 'UNPAID').length,
      overdueCount: filteredItems.filter((i) => i.status === 'OVERDUE').length,
    };

    if (format === 'csv') {
      const headers = ['Family Code', 'Head Name', 'Phone', 'Ward', 'Address', 'Recurring Frequency', 'Recurring Amount (INR)', 'Outstanding Dues (INR)', 'Next Due Date', 'Status'];
      const rows = filteredItems.map((item) => [
        item.familyCode,
        item.headName,
        item.headPhone,
        item.wardNo,
        item.address,
        item.recurringType,
        item.recurringAmount,
        item.outstandingBalance,
        item.nextPaymentDueDate ? new Date(item.nextPaymentDueDate).toISOString().split('T')[0] : '',
        item.status,
      ]);
      return { format: 'csv' as const, content: buildCSV(headers, rows), filename: `recurring_donations_report_${Date.now()}.csv` };
    }

    return { format: 'json' as const, data: { summary, items: filteredItems } };
  }

  static async getAll(
    tenantId: string,
    query: {
      page?: string;
      limit?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
      includeDeleted?: string;
    },
  ) {
    const { page = '1', limit = '100', search, sortBy = 'familyCode', sortOrder = 'asc', includeDeleted } = query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(parseInt(limit), 2000);

    const filter: Record<string, unknown> = {
      $or: [{ tenantId: tenantId }, { tenantId: tenantId?.toString() }],
    };

    if (includeDeleted !== 'true') {
      filter.isDeleted = { $ne: true };
    }

    if (search) {
      const cleanSearch = String(search).trim();
      const searchRegex = new RegExp(escapeSearchRegex(cleanSearch), 'i');

      const memberIds = await FamilyRepository.findMatchingMemberIds(tenantId, [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { memberId: searchRegex },
      ]);

      let familyCodeRegex = searchRegex;
      if (/^\d+$/.test(cleanSearch)) {
        familyCodeRegex = new RegExp(`(^|\\D)0*${cleanSearch}(\\D|$)`, 'i');
      }

      filter.$and = [
        {
          $or: [
            { familyCode: familyCodeRegex },
            { familyCode: searchRegex },
            { 'address.line1': searchRegex },
            { wardNo: searchRegex },
            { headMemberId: { $in: memberIds } },
            { 'members.memberId': { $in: memberIds } },
          ],
        },
      ];
    }

    const sortDir = sortOrder === 'desc' ? -1 : 1;
    const sortObj: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const [families, total] = await Promise.all([
      FamilyRepository.findAllPaginated(filter, sortObj, (pageNum - 1) * limitNum, limitNum),
      FamilyRepository.count(filter),
    ]);

    const enhancedFamilies = await Promise.all(
      families.map(async (f: any) => {
        let head = f.headMemberId;
        if (!head || !head.name) {
          const headEntry = f.members?.find(
            (m: any) => m.isHead || (typeof m.relationship === 'string' && m.relationship.toLowerCase().includes('head')),
          );
          if (headEntry && headEntry.memberId && (headEntry.memberId as any).name) {
            head = headEntry.memberId;
          }
        }
        if (!head || !head.name) {
          const mHead = await FamilyRepository.findHeadMemberFallback(f._id);
          if (mHead) head = mHead;
        }

        let nextDue = f.nextPaymentDueDate;
        if (!nextDue && f.recurringDonationType && f.recurringDonationType !== 'none') {
          nextDue = calculateNextDueDate(f.recurringDonationType, f.recurringPaymentDay, f.recurringPaymentMonth, f.lastPaymentDate);
        }

        return { ...f, headMemberId: head || f.headMemberId, nextPaymentDueDate: nextDue };
      }),
    );

    return { families: enhancedFamilies, pagination: buildPaginationMeta(pageNum, limitNum, total) };
  }

  static async getById(id: string, tenantId: string) {
    const family = await FamilyRepository.findByIdAndTenant(id, tenantId);
    if (!family) throw new AppError('Family not found', 404);

    let nextDue = family.nextPaymentDueDate;
    if (!nextDue && family.recurringDonationType && family.recurringDonationType !== 'none') {
      nextDue = calculateNextDueDate(family.recurringDonationType, family.recurringPaymentDay, family.recurringPaymentMonth, family.lastPaymentDate);
    }

    return { ...family, nextPaymentDueDate: nextDue };
  }

  static async create(tenantId: string, body: Record<string, any>) {
    const count = await FamilyRepository.count({ tenantId });
    const familyCode = generateSequentialId('FAM', count, { includeYear: false, padWidth: 4 });
    const qrData = JSON.stringify({ familyCode, tenantId, type: 'family' });
    const qrCode = await QRCode.toDataURL(qrData);

    const recurringType = body.recurringDonationType;
    const recurringDay = body.recurringPaymentDay || 1;
    const recurringMonth = body.recurringPaymentMonth || 1;
    const nextPaymentDueDate = calculateNextDueDate(recurringType, recurringDay, recurringMonth);

    return FamilyRepository.create({ ...body, tenantId, familyCode, qrCode, nextPaymentDueDate });
  }

  static async update(id: string, tenantId: string, body: Record<string, any>) {
    const update = { ...body };
    if (update.recurringDonationType !== undefined || update.recurringPaymentDay !== undefined || update.recurringPaymentMonth !== undefined) {
      update.nextPaymentDueDate = calculateNextDueDate(
        update.recurringDonationType,
        update.recurringPaymentDay,
        update.recurringPaymentMonth,
        update.lastPaymentDate,
      );
    }

    if (update.markPending === true || update.setPendingDues === true) {
      const amount = Number(update.recurringDonationAmount) || 0;
      update.outstandingBalance = amount > 0 ? amount : Math.max(update.outstandingBalance || 0, 100);
      update.nextPaymentDueDate = new Date();
    } else if (update.markPending === false) {
      update.outstandingBalance = 0;
    }

    const family = await FamilyRepository.updateByIdAndTenant(id, tenantId, update);
    if (!family) throw new AppError('Family not found', 404);
    return family;
  }

  static async remove(id: string, tenantId: string) {
    await FamilyRepository.softDeleteByIdAndTenant(id, tenantId);
  }

  static async restoreAll(tenantId: string) {
    const result = await FamilyRepository.restoreAllForTenant(tenantId);
    return {
      restoredCount: result.modifiedCount,
      message: `Successfully restored ${result.modifiedCount} soft-deleted families!`,
    };
  }

  static async bulkAssignRecurring(
    tenantId: string,
    body: {
      familyIds?: string[];
      isAllFamilies?: boolean;
      recurringDonationType?: 'monthly' | 'yearly' | 'none';
      recurringDonationAmount?: number;
      recurringPaymentDay?: number;
      recurringPaymentMonth?: number;
      markPending?: boolean;
    },
  ) {
    const {
      familyIds = [],
      isAllFamilies = false,
      recurringDonationType = 'monthly',
      recurringDonationAmount = 0,
      recurringPaymentDay = 1,
      recurringPaymentMonth = 1,
      markPending = false,
    } = body;

    const filter: any = { tenantId, isDeleted: { $ne: true } };
    if (!isAllFamilies && Array.isArray(familyIds) && familyIds.length > 0) {
      filter._id = { $in: familyIds };
    }

    const nextPaymentDueDate = calculateNextDueDate(recurringDonationType, recurringPaymentDay, recurringPaymentMonth);

    const updatePayload: any = {
      recurringDonationType,
      recurringDonationAmount: Number(recurringDonationAmount) || 0,
      recurringPaymentDay: Number(recurringPaymentDay) || 1,
      recurringPaymentMonth: Number(recurringPaymentMonth) || 1,
      nextPaymentDueDate,
    };

    if (markPending) {
      const amt = Number(recurringDonationAmount) || 0;
      updatePayload.outstandingBalance = amt > 0 ? amt : 100;
      updatePayload.nextPaymentDueDate = new Date();
    }

    const result = await FamilyRepository.bulkUpdate(filter, updatePayload);

    return {
      modifiedCount: result.modifiedCount,
      message: `Successfully assigned recurring donation to ${result.modifiedCount} families!`,
    };
  }

  static async remindRecurring(id: string, tenantId: string) {
    const family = await FamilyRepository.findByIdAndTenantRaw(id, tenantId);
    if (!family) throw new AppError('Family not found', 404);

    if (!family.headMemberId) {
      throw new AppError('Family has no head member assigned to receive the alert', 400);
    }

    const headUser = await FamilyRepository.findUserByMemberAndTenant(family.headMemberId, family.tenantId);
    if (!headUser) {
      throw new AppError('Family head does not have a user account to receive alerts', 400);
    }

    const amountStr = family.recurringDonationAmount ? `₹${family.recurringDonationAmount}` : '';
    const typeStr = family.recurringDonationType ? `(${family.recurringDonationType})` : '';

    await FamilyRepository.createNotification({
      tenantId: family.tenantId,
      channel: NotificationChannel.IN_APP,
      recipientId: headUser._id,
      title: 'Reminder: Recurring Donation Due',
      body: `Reminder: Your family recurring donation ${amountStr} ${typeStr} is due soon. Please clear your dues at your earliest convenience.`,
      status: 'pending',
    });
  }
}

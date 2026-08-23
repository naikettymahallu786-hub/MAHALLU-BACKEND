import mongoose from 'mongoose';
import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { Student } from '../models/Student';
import { Teacher } from '../models/Teacher';
import { Payment } from '../models/Payment';
import { Donation } from '../models/Donation';
import { Attendance } from '../models/Attendance';
import { Transaction } from '../models/Transaction';
import { PaymentType, PaymentStatus } from "../types";

export class DashboardRepository {
  static async countFamilies(tenantId: mongoose.Types.ObjectId) {
    return Family.countDocuments({ tenantId, isDeleted: { $ne: true } });
  }

  static async countActiveMembers(tenantId: mongoose.Types.ObjectId) {
    return Member.countDocuments({ tenantId, status: 'active', isDeleted: { $ne: true } });
  }

  static async countActiveStudents(tenantId: mongoose.Types.ObjectId) {
    return Student.countDocuments({ tenantId, status: 'active' });
  }

  static async countActiveTeachers(tenantId: mongoose.Types.ObjectId) {
    return Teacher.countDocuments({ tenantId, status: 'active' });
  }

  static async sumMonthlyIncomePayments(tenantId: mongoose.Types.ObjectId, monthStart: Date, monthEnd: Date) {
    return Payment.aggregate([
      {
        $match: {
          tenantId,
          status: PaymentStatus.SUCCESS,
          createdAt: { $gte: monthStart, $lte: monthEnd },
          type: { $in: [PaymentType.SUBSCRIPTION, PaymentType.DONATION, PaymentType.RENTAL, PaymentType.ZAKAT] },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  }

  static async sumMonthlyExpensePayments(tenantId: mongoose.Types.ObjectId, monthStart: Date, monthEnd: Date) {
    return Payment.aggregate([
      {
        $match: {
          tenantId,
          status: PaymentStatus.SUCCESS,
          createdAt: { $gte: monthStart, $lte: monthEnd },
          type: { $in: [PaymentType.SALARY, PaymentType.MAINTENANCE] },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  }

  static async sumActiveStudentFeeBalances(tenantId: mongoose.Types.ObjectId) {
    return Student.aggregate([
      { $match: { tenantId, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$feeBalance' } } },
    ]);
  }

  static async sumMonthlyDonations(tenantId: mongoose.Types.ObjectId, monthStart: Date, monthEnd: Date) {
    const [paymentDonations, donationDocs] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            tenantId,
            type: { $in: [PaymentType.DONATION, 'donation', PaymentType.ZAKAT, 'zakat'] },
            status: PaymentStatus.SUCCESS,
            createdAt: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Donation.aggregate([
        { $match: { tenantId, createdAt: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const total = (paymentDonations[0]?.total || 0) + (donationDocs[0]?.total || 0);
    return [{ total }];
  }

  static async sumZakatCollected(tenantId: mongoose.Types.ObjectId) {
    const [paymentDonations, donationDocs] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            tenantId,
            type: { $in: [PaymentType.DONATION, 'donation', PaymentType.ZAKAT, 'zakat'] },
            status: PaymentStatus.SUCCESS,
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Donation.aggregate([
        { $match: { tenantId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const total = (paymentDonations[0]?.total || 0) + (donationDocs[0]?.total || 0);
    return [{ total }];
  }

  static async sumMonthlyIncomeTransactions(tenantId: mongoose.Types.ObjectId, monthStart: Date, monthEnd: Date) {
    return Transaction.aggregate([
      { $match: { tenantId, type: 'INCOME', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  }

  static async sumMonthlyExpenseTransactions(tenantId: mongoose.Types.ObjectId, monthStart: Date, monthEnd: Date) {
    return Transaction.aggregate([
      { $match: { tenantId, type: 'EXPENSE', date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  }

  static async aggregatePaymentsByMonth(tenantId: mongoose.Types.ObjectId, since: Date) {
    return Payment.aggregate([
      {
        $match: {
          tenantId,
          status: PaymentStatus.SUCCESS,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            isExpense: {
              $in: ['$type', [PaymentType.SALARY, PaymentType.MAINTENANCE]],
            },
          },
          total: { $sum: '$amount' },
        },
      },
    ]);
  }

  static async aggregateTransactionsByMonth(tenantId: mongoose.Types.ObjectId, since: Date) {
    return Transaction.aggregate([
      { $match: { tenantId, date: { $gte: since } } },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            isExpense: { $eq: ['$type', 'EXPENSE'] },
          },
          total: { $sum: '$amount' },
        },
      },
    ]);
  }

  static async aggregateStudentAttendanceByDateStatus(tenantId: mongoose.Types.ObjectId, since: Date) {
    return Attendance.aggregate([
      { $match: { tenantId, entityType: 'student', date: { $gte: since } } },
      {
        $group: {
          _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, status: '$status' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);
  }

  static async aggregateMemberGrowthByMonth(tenantId: mongoose.Types.ObjectId, since: Date) {
    return Member.aggregate([
      { $match: { tenantId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
  }

  static async findRecentMembers(tenantId: string) {
    return Member.find({ tenantId }).sort({ createdAt: -1 }).limit(5).select('name memberId photo createdAt').lean();
  }

  static async findRecentSuccessfulPayments(tenantId: string) {
    return Payment.find({ tenantId, status: PaymentStatus.SUCCESS })
      .sort({ createdAt: -1 }).limit(5)
      .populate('paidById', 'name').lean();
  }

  static async findRecentDonations(tenantId: string) {
    return Donation.find({ tenantId }).sort({ createdAt: -1 }).limit(5)
      .populate('donorId', 'name').lean();
  }
}

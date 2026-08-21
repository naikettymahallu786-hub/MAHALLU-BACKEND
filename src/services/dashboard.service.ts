import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { DashboardRepository } from '../repositories/dashboard.repository';

export class DashboardService {
  static async getKPIs(tenantIdStr: string) {
    const tenantId = new mongoose.Types.ObjectId(tenantIdStr);
    const currentMonth = dayjs().startOf('month').toDate();
    const currentMonthEnd = dayjs().endOf('month').toDate();

    const [
      totalFamilies,
      totalMembers,
      activeStudents,
      activeTeachers,
      monthlyIncome,
      monthlyExpenses,
      pendingFees,
      monthlyDonations,
      zakatCollected,
      txIncome,
      txExpense,
    ] = await Promise.all([
      DashboardRepository.countFamilies(tenantId),
      DashboardRepository.countActiveMembers(tenantId),
      DashboardRepository.countActiveStudents(tenantId),
      DashboardRepository.countActiveTeachers(tenantId),
      DashboardRepository.sumMonthlyIncomePayments(tenantId, currentMonth, currentMonthEnd),
      DashboardRepository.sumMonthlyExpensePayments(tenantId, currentMonth, currentMonthEnd),
      DashboardRepository.sumActiveStudentFeeBalances(tenantId),
      DashboardRepository.sumMonthlyDonations(tenantId, currentMonth, currentMonthEnd),
      DashboardRepository.sumZakatCollected(tenantId),
      DashboardRepository.sumMonthlyIncomeTransactions(tenantId, currentMonth, currentMonthEnd),
      DashboardRepository.sumMonthlyExpenseTransactions(tenantId, currentMonth, currentMonthEnd),
    ]);

    return {
      totalFamilies,
      totalMembers,
      activeStudents,
      activeTeachers,
      monthlyIncome: (monthlyIncome[0]?.total || 0) + (txIncome[0]?.total || 0),
      monthlyExpenses: (monthlyExpenses[0]?.total || 0) + (txExpense[0]?.total || 0),
      pendingFees: pendingFees[0]?.total || 0,
      monthlyDonations: monthlyDonations[0]?.total || 0,
      zakatCollected: zakatCollected[0]?.total || 0,
    };
  }

  static async getIncomeExpenseChart(tenantIdStr: string) {
    const tenantId = new mongoose.Types.ObjectId(tenantIdStr);
    const last6Months = dayjs().subtract(6, 'month').startOf('month').toDate();

    const [paymentData, txData] = await Promise.all([
      DashboardRepository.aggregatePaymentsByMonth(tenantId, last6Months),
      DashboardRepository.aggregateTransactionsByMonth(tenantId, last6Months),
    ]);

    // Combine
    const mergedMap = new Map<string, any>();
    [...paymentData, ...txData].forEach(item => {
      const key = `${item._id.year}-${item._id.month}-${item._id.isExpense}`;
      if (mergedMap.has(key)) {
        mergedMap.get(key).total += item.total;
      } else {
        mergedMap.set(key, { ...item });
      }
    });

    return Array.from(mergedMap.values()).sort((a, b) => {
      if (a._id.year !== b._id.year) return a._id.year - b._id.year;
      return a._id.month - b._id.month;
    });
  }

  static async getAttendanceChart(tenantIdStr: string) {
    const tenantId = new mongoose.Types.ObjectId(tenantIdStr);
    const last30Days = dayjs().subtract(30, 'days').toDate();

    return DashboardRepository.aggregateStudentAttendanceByDateStatus(tenantId, last30Days);
  }

  static async getMemberGrowthChart(tenantIdStr: string) {
    const tenantId = new mongoose.Types.ObjectId(tenantIdStr);
    const last12Months = dayjs().subtract(12, 'month').startOf('month').toDate();

    return DashboardRepository.aggregateMemberGrowthByMonth(tenantId, last12Months);
  }

  static async getRecentActivity(tenantIdStr: string) {
    // Mongoose find() casts string to ObjectId automatically
    const [recentMembers, recentPayments, recentDonations] = await Promise.all([
      DashboardRepository.findRecentMembers(tenantIdStr),
      DashboardRepository.findRecentSuccessfulPayments(tenantIdStr),
      DashboardRepository.findRecentDonations(tenantIdStr),
    ]);

    return { recentMembers, recentPayments, recentDonations };
  }
}

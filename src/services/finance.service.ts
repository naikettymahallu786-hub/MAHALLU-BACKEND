import { AppError } from '../middleware/errorHandler';
import { FinanceRepository } from '../repositories/finance.repository';

export class FinanceService {
  static async getTransactions(tenantId: string, year?: string) {
    const query: Record<string, unknown> = { tenantId };

    if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00Z`);
      const endDate = new Date(`${year}-12-31T23:59:59Z`);
      query.date = { $gte: startDate, $lte: endDate };
    }

    return FinanceRepository.findAllByFilter(query);
  }

  static async createTransaction(
    tenantId: string,
    userId: string,
    body: { type?: string; amount?: number; category?: string; date?: string; description?: string; referenceNo?: string },
  ) {
    const { type, amount, category, date, description, referenceNo } = body;

    if (!type || !amount || !category || !date || !description) {
      throw new AppError('Missing required fields', 400);
    }

    return FinanceRepository.create({
      tenantId,
      type,
      amount,
      category,
      date: new Date(date),
      description,
      referenceNo,
      recordedBy: userId,
    });
  }
}

import { Transaction } from '../models/Transaction';

export class FinanceRepository {
  static async findAllByFilter(filter: Record<string, unknown>) {
    return Transaction.find(filter).sort({ date: -1, createdAt: -1 }).populate('recordedBy', 'name').lean();
  }

  static async create(data: Record<string, unknown>) {
    return Transaction.create(data);
  }
}

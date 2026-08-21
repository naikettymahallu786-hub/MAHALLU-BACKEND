import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FinanceService } from '../services/finance.service';

export class FinanceController {
  static async getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await FinanceService.getTransactions(req.user!.tenantId, req.query.year as string | undefined);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async createTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await FinanceService.createTransaction(req.user!.tenantId, req.user!.userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

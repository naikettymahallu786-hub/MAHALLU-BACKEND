import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ReceiptService } from '../services/receipt.service';

export class ReceiptController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ReceiptService.getAll(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ReceiptService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async createManual(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ReceiptService.createManual(req.user!.tenantId, req.user!.userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

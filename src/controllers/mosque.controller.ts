import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MosqueService } from '../services/mosque.service';

export class MosqueController {
  static async get(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await MosqueService.getForTenant(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async upsert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await MosqueService.upsertForTenant(req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getPrayerTimes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await MosqueService.getPrayerTimes(req.query as any);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

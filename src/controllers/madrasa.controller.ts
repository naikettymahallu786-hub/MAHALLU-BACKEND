import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MadrasaService } from '../services/madrasa.service';

export class MadrasaController {
  static async get(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await MadrasaService.getForTenant(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async upsert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await MadrasaService.upsertForTenant(req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

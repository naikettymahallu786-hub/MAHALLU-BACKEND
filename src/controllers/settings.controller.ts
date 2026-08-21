import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SettingsService } from '../services/settings.service';

export class SettingsController {
  static async get(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await SettingsService.getForTenant(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async upsert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await SettingsService.upsertForTenant(req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

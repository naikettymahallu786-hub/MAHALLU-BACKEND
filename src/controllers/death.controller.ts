import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { DeathService } from '../services/death.service';

export class DeathController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DeathService.getAll(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await DeathService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

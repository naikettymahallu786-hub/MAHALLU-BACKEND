import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NikahService } from '../services/nikah.service';

export class NikahController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await NikahService.getAll(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await NikahService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await NikahService.getById(req.params.id, req.user!.tenantId);
      if (!record) {
        res.status(404).json({ success: false, message: 'Nikah entry not found' });
        return;
      }
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await NikahService.update(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await NikahService.remove(req.params.id, req.user!.tenantId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

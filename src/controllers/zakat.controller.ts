import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ZakatService } from '../services/zakat.service';

export class ZakatController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ZakatService.getAll(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ZakatService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async apply(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ZakatService.apply(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updateApplicantStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, amountApproved } = req.body;
      await ZakatService.updateApplicantStatus(req.params.id, req.user!.tenantId, req.params.memberId, {
        status,
        amountApproved,
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { DonationService } from '../services/donation.service';

export class DonationController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { donations, pagination } = await DonationService.getAll(req.user!.tenantId, req.query as any);
      res.json({ success: true, data: donations, pagination });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DonationService.create(req.user!.tenantId, req.user!.userId, req.body);

      if (result && typeof result === 'object' && 'message' in result && 'data' in result) {
        res.status(201).json({ success: true, message: result.message, data: result.data });
        return;
      }

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async collect(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DonationService.collect(req.params.id, req.user!.tenantId, req.user!.userId, req.body);

      if (result.outcome === 'not_found') {
        res.status(404).json({ success: false, message: 'Donation not found' });
        return;
      }
      if (result.outcome === 'already_paid') {
        res.status(400).json({ success: false, message: 'Donation is already paid' });
        return;
      }

      res.json({
        success: true,
        message: 'Donation collected successfully',
        data: { donation: result.donation, payment: result.payment, receipt: result.receipt },
      });
    } catch (error) {
      next(error);
    }
  }
}

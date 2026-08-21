import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { InboxService } from '../services/inbox.service';

export class InboxController {
  static async getUnified(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await InboxService.getUnified(req.user!.tenantId, req.query.status as string | undefined);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

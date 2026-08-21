import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';

export class NotificationController {
  static async getRecent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await NotificationService.getRecent(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // The Socket.IO emit reads req.app, so it stays here rather than in the
  // service (services must not depend on Express types).
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const n = await NotificationService.create(req.user!.tenantId, req.body);

      const io = req.app.get('io');
      if (io) {
        io.to(`tenant-${req.user!.tenantId}`).emit('new-notice', {
          title: n.title,
          body: (n as any).message || n.body || 'You have a new notice announcement.',
        });
      }

      res.status(201).json({ success: true, data: n });
    } catch (error) {
      next(error);
    }
  }
}

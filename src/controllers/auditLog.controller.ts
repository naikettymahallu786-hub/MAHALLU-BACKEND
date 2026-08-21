import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuditLogService } from '../services/auditLog.service';

export class AuditLogController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { logs, pagination } = await AuditLogService.getAll(req.user!.tenantId, req.query as any);
      res.json({ success: true, data: logs, pagination });
    } catch (error) {
      next(error);
    }
  }
}

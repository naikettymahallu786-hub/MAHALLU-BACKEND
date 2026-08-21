import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CertificateService } from '../services/certificate.service';

export class CertificateController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await CertificateService.getAll(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getAllRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string;
      const data = await CertificateService.getAllRequests(req.user!.tenantId, status);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getRequestById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await CertificateService.getRequestById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async approveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await CertificateService.approveRequest(
        req.params.id,
        req.user!.tenantId,
        req.user!.userId,
        req.body,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async rejectRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await CertificateService.rejectRequest(req.params.id, req.user!.tenantId, req.body.notes);
      res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await CertificateService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MobileSadarService } from '../services/mobileSadar.service';

export class MobileSadarController {
  static async getFamilies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileSadarService.getFamilies(req.user!.userId, req.user!.tenantId);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async getFamilyMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileSadarService.getFamilyMembers(req.user!.userId, req.user!.tenantId, req.params.familyId);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async getClasses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileSadarService.getClasses(req.user!.userId, req.user!.tenantId);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async createStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileSadarService.createStudent(req.user!.userId, req.user!.tenantId, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }
}

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TeacherService } from '../services/teacher.service';

export class TeacherController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { teachers, pagination } = await TeacherService.getAll(req.user!.tenantId, req.query as any);
      res.json({ success: true, data: teachers, pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TeacherService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TeacherService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await TeacherService.update(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { StudentService } from '../services/student.service';

export class StudentController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { students, pagination } = await StudentService.getAll(req.user!.tenantId, req.query as any);
      res.json({ success: true, data: students, pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await StudentService.getById(req.params.id, req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await StudentService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await StudentService.update(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await StudentService.remove(req.params.id, req.user!.tenantId);
      res.json({ success: true, message: 'Student removed' });
    } catch (error) {
      next(error);
    }
  }
}

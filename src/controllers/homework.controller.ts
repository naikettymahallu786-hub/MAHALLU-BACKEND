import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { HomeworkService } from '../services/homework.service';

export class HomeworkController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await HomeworkService.getAll(req.user!.tenantId, req.query.classId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await HomeworkService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async submit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await HomeworkService.submit(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async grade(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, grade, feedback } = req.body;
      await HomeworkService.grade(req.params.id, req.user!.tenantId, { studentId, grade, feedback });
      res.json({ success: true, message: 'Graded' });
    } catch (error) {
      next(error);
    }
  }
}

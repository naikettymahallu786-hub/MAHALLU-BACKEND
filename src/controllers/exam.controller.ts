import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ExamService } from '../services/exam.service';

export class ExamController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ExamService.getAll(req.user!.tenantId, req.query.classId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ExamService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updateResults(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ExamService.updateResults(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

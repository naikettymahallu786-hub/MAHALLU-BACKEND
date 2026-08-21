import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MobileUstadhService } from '../services/mobileUstadh.service';

export class MobileUstadhController {
  static async getClasses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const classes = await MobileUstadhService.getClasses(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: classes });
    } catch (e) {
      next(e);
    }
  }

  static async updateTimetable(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { schedule } = req.body;
      const result = await MobileUstadhService.updateTimetable(req.user!.userId, req.user!.tenantId, req.params.id, schedule);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async markAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileUstadhService.markAttendance(req.user!.userId, req.user!.tenantId, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async notify(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileUstadhService.notify(req.user!.userId, req.user!.tenantId, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async getHomework(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const homework = await MobileUstadhService.getHomework(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: homework });
    } catch (e) {
      next(e);
    }
  }

  static async createHomework(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileUstadhService.createHomework(req.user!.userId, req.user!.tenantId, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async gradeHomework(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileUstadhService.gradeHomework(req.user!.userId, req.user!.tenantId, req.params.id, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async getExams(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const exams = await MobileUstadhService.getExams(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: exams });
    } catch (e) {
      next(e);
    }
  }

  static async createExam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileUstadhService.createExam(req.user!.userId, req.user!.tenantId, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async saveExamResults(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileUstadhService.saveExamResults(req.user!.userId, req.user!.tenantId, req.params.id, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }
}

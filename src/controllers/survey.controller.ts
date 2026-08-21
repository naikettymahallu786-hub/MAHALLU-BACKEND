import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SurveyService } from '../services/survey.service';

export class SurveyController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await SurveyService.getAll(req.user!.tenantId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await SurveyService.create(req.user!.tenantId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async respond(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await SurveyService.respond(req.params.id, req.user!.tenantId, req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

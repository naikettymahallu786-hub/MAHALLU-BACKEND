import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AttendanceService } from '../services/attendance.service';

export class AttendanceController {
  static async bulkMark(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await AttendanceService.bulkMark(req.user!.tenantId, req.user!.userId, req.body);
      res.json({ success: true, message: `${count} attendance records saved` });
    } catch (error) {
      next(error);
    }
  }

  static async getClassAttendanceForDate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AttendanceService.getClassAttendanceForDate(
        req.user!.tenantId,
        req.params.classId,
        req.query.date as string | undefined,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getClassMonthlyAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AttendanceService.getClassMonthlyAttendance(
        req.user!.tenantId,
        req.params.classId,
        req.query.year as string | undefined,
        req.query.month as string | undefined,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AttendanceService.getReport(req.user!.tenantId, req.query as any);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

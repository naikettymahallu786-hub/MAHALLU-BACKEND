import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MobileGeneralService } from '../services/mobileGeneral.service';

export class MobileGeneralController {
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileGeneralService.getProfile(req.user!.userId, req.user!.tenantId);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async getFamily(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const family = await MobileGeneralService.getFamily(req.user!.userId);
      res.json({ success: true, data: family });
    } catch (e) {
      next(e);
    }
  }

  static async updateFamily(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const family = await MobileGeneralService.updateFamily(req.user!.userId, req.body);
      res.json({ success: true, data: family });
    } catch (e) {
      next(e);
    }
  }

  static async updateMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const member = await MobileGeneralService.updateMember(req.user!.userId, req.user!.tenantId, req.params.memberId, req.body);
      res.json({ success: true, message: 'Member details updated successfully', data: member });
    } catch (e) {
      next(e);
    }
  }

  static async getPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileGeneralService.getPayments(req.user!.userId, req.user!.tenantId, req.query as any);
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (e) {
      next(e);
    }
  }

  static async getDonations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const donations = await MobileGeneralService.getDonations(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: donations });
    } catch (e) {
      next(e);
    }
  }

  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const notifications = await MobileGeneralService.getNotifications(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: notifications });
    } catch (e) {
      next(e);
    }
  }

  static async getDues(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dues = await MobileGeneralService.getDues(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: dues });
    } catch (e) {
      next(e);
    }
  }

  static async getStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const student = await MobileGeneralService.getStudent(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: student });
    } catch (e) {
      next(e);
    }
  }

  static async getStudentAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const records = await MobileGeneralService.getStudentAttendance(req.user!.userId, req.user!.tenantId, req.query as any);
      res.json({ success: true, data: records });
    } catch (e) {
      next(e);
    }
  }

  static async getStudentHomework(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const homework = await MobileGeneralService.getStudentHomework(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: homework });
    } catch (e) {
      next(e);
    }
  }

  static async getStudentExams(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const exams = await MobileGeneralService.getStudentExams(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: exams });
    } catch (e) {
      next(e);
    }
  }

  static async getChildren(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const children = await MobileGeneralService.getChildren(req.user!.userId, req.user!.tenantId);
      res.json({ success: true, data: children });
    } catch (e) {
      next(e);
    }
  }

  static async getEvents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const events = await MobileGeneralService.getEvents(req.user!.tenantId, req.query as any);
      res.json({ success: true, data: events });
    } catch (e) {
      next(e);
    }
  }

  static async getAnnouncements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const announcements = await MobileGeneralService.getAnnouncements(req.user!.tenantId);
      res.json({ success: true, data: announcements });
    } catch (e) {
      next(e);
    }
  }

  static async getPrayerTimes(req: AuthRequest, res: Response): Promise<void> {
    const result = await MobileGeneralService.getPrayerTimes(req.user!.tenantId, req.query as any);
    res.json({ success: true, ...result });
  }

  static async getTeachers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const teachers = await MobileGeneralService.getTeachers(req.user!.tenantId);
      res.json({ success: true, data: teachers });
    } catch (e) {
      next(e);
    }
  }

  static async getCertificates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileGeneralService.getCertificates(req.user!.userId, req.user!.tenantId);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async requestCertificate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileGeneralService.requestCertificate(req.user!.userId, req.user!.tenantId, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async getProperties(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileGeneralService.getProperties(req.user!.userId, req.user!.tenantId);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async requestPropertyRental(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileGeneralService.requestPropertyRental(req.user!.userId, req.user!.tenantId, req.body);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }

  static async getFamilyStudents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await MobileGeneralService.getFamilyStudents(req.user!.userId, req.user!.tenantId);
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  }
}

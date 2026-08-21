import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PERMISSIONS } from "../config/constants";
import { AttendanceController } from '../controllers/attendance.controller';

const r = Router();
r.use(authenticate);

r.post('/bulk', authorize(PERMISSIONS.ATTENDANCE_MARK), AttendanceController.bulkMark);
r.get('/class/:classId', authorize(PERMISSIONS.ATTENDANCE_VIEW), AttendanceController.getClassAttendanceForDate);
r.get('/class/:classId/monthly', authorize(PERMISSIONS.ATTENDANCE_VIEW), AttendanceController.getClassMonthlyAttendance);
r.get('/report', authorize(PERMISSIONS.ATTENDANCE_REPORTS), AttendanceController.getReport);

export default r;

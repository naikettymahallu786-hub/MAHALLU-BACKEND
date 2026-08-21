import { Attendance } from '../models/Attendance';
import { Student } from '../models/Student';

export class AttendanceRepository {
  static async bulkWrite(ops: any[]) {
    await Attendance.bulkWrite(ops);
  }

  static async findActiveStudentsByClass(tenantId: string, classId: string) {
    return Student.find({ tenantId, classId, status: 'active', isDeleted: { $ne: true } })
      .populate({ path: 'memberId', select: 'name', options: { strictPopulate: false } })
      .lean();
  }

  static async findByClassAndDate(tenantId: string, classId: string, date: Date) {
    return Attendance.find({ tenantId, classId, date }).lean();
  }

  static async findByClassAndDateRange(tenantId: string, classId: string, start: Date, end: Date) {
    return Attendance.find({ tenantId, classId, date: { $gte: start, $lte: end } })
      .select('entityId date status')
      .lean();
  }

  static async aggregateByFilter(filter: Record<string, unknown>) {
    return Attendance.aggregate([
      { $match: filter },
      { $group: { _id: { entityId: '$entityId', status: '$status' }, count: { $sum: 1 } } },
      { $group: { _id: '$_id.entityId', attendance: { $push: { status: '$_id.status', count: '$count' } } } },
    ]);
  }
}

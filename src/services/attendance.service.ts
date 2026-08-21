import mongoose from 'mongoose';
import { AttendanceStatus } from "../types";
import dayjs from 'dayjs';
import { AttendanceRepository } from '../repositories/attendance.repository';

export class AttendanceService {
  // No input validation on `records` here — matches the pre-existing
  // behavior exactly (throws if records is undefined/not an array).
  static async bulkMark(
    tenantId: string,
    userId: string,
    body: { records: Array<{ entityId: string; status: AttendanceStatus; date?: string }>; classId?: string; date?: string; entityType?: string },
  ) {
    const { records, classId, date, entityType } = body;
    const ops = records.map((record) => {
      const recordDate = record.date ? new Date(record.date) : new Date(date!);
      return {
        updateOne: {
          filter: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            entityId: new mongoose.Types.ObjectId(record.entityId),
            date: recordDate,
          },
          update: {
            $set: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              entityId: new mongoose.Types.ObjectId(record.entityId),
              entityType,
              classId: classId ? new mongoose.Types.ObjectId(classId) : undefined,
              date: recordDate,
              status: record.status,
              markedById: new mongoose.Types.ObjectId(userId),
            },
          },
          upsert: true,
        },
      };
    });
    await AttendanceRepository.bulkWrite(ops);
    return records.length;
  }

  static async getClassAttendanceForDate(tenantId: string, classId: string, dateInput?: string) {
    const queryDate = dateInput ? new Date(dateInput) : dayjs().startOf('day').toDate();
    queryDate.setHours(0, 0, 0, 0);

    const students = await AttendanceRepository.findActiveStudentsByClass(tenantId, classId);
    const records = await AttendanceRepository.findByClassAndDate(tenantId, classId, queryDate);

    const recordsMap = new Map(records.map((r: any) => [r.entityId?.toString() || '', r]));

    return students.map((s: any) => {
      const savedRecord: any = recordsMap.get(s._id.toString());
      return {
        _id: savedRecord?._id || undefined,
        entityId: {
          _id: s._id,
          name: s.memberId?.name || s.name || 'Unknown Student',
          admissionNo: s.admissionNo || '—',
        },
        date: queryDate,
        status: savedRecord?.status || 'present',
        isSaved: !!savedRecord,
      };
    });
  }

  static async getClassMonthlyAttendance(tenantId: string, classId: string, yearInput?: string, monthInput?: string) {
    const y = parseInt(yearInput as string) || new Date().getFullYear();
    const m = parseInt(monthInput as string) || new Date().getMonth() + 1;

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);
    endDate.setHours(23, 59, 59, 999);

    const records = await AttendanceRepository.findByClassAndDateRange(tenantId, classId, startDate, endDate);
    const students = await AttendanceRepository.findActiveStudentsByClass(tenantId, classId);

    const formattedStudents = students.map((s: any) => ({
      _id: s._id,
      name: s.memberId?.name || s.name || 'Unknown Student',
      admissionNo: s.admissionNo || '—',
    }));

    return {
      students: formattedStudents,
      records: records.map((r: any) => ({ entityId: r.entityId, date: r.date, status: r.status })),
    };
  }

  static async getReport(
    tenantId: string,
    query: { classId?: string; startDate?: string; endDate?: string; entityType?: string },
  ) {
    const { classId, startDate, endDate, entityType } = query;
    const filter: Record<string, unknown> = { tenantId, entityType };
    if (classId) filter.classId = classId;
    if (startDate && endDate) filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };

    return AttendanceRepository.aggregateByFilter(filter);
  }
}

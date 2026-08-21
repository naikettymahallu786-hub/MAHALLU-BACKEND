import mongoose from 'mongoose';
import { User } from '../models/User';
import { Teacher } from '../models/Teacher';
import { Class } from '../models/Class';
import { Student } from '../models/Student';
import { Attendance } from '../models/Attendance';
import { Notification } from '../models/Notification';
import { Homework } from '../models/Homework';
import { Exam } from '../models/Exam';

export class MobileUstadhRepository {
  static async findUserRoleAndMemberId(userId: string) {
    return User.findById(userId).select('memberId role').lean();
  }

  static async findTeacherId(tenantId: string, memberId: unknown) {
    return Teacher.findOne({ tenantId, memberId }).select('_id').lean();
  }

  static async findTeacherIdAndAssignedStudents(tenantId: string, memberId: unknown) {
    return Teacher.findOne({ tenantId, memberId }).select('_id assignedStudents').lean();
  }

  static async findTeacherIdAndMadrasaId(tenantId: string, memberId: unknown) {
    return Teacher.findOne({ tenantId, memberId }).select('_id madrasaId').lean();
  }

  static async findClassesByTeacher(tenantId: string, teacherId: unknown) {
    return Class.find({ tenantId, teacherId }).lean();
  }

  static async findActiveStudentsByClassIds(tenantId: string, classIds: unknown[]) {
    return Student.find({
      tenantId,
      classId: { $in: classIds },
      status: 'active',
      isDeleted: { $ne: true },
    })
      .populate({ path: 'memberId', select: 'name photo phone gender', options: { strictPopulate: false } })
      .lean();
  }

  static async findDirectAssignedStudents(assignedStudents: unknown[]) {
    return Student.find({ _id: { $in: assignedStudents }, isDeleted: { $ne: true } })
      .populate('memberId', 'name photo phone gender')
      .lean();
  }

  static async setTeacherSchedule(teacherId: unknown, schedule: unknown) {
    await Teacher.updateOne({ _id: teacherId }, { $set: { schedule } });
  }

  static async findClassForTeacher(id: string, tenantId: string, teacherId: unknown) {
    return Class.findOne({ _id: id, tenantId, teacherId });
  }

  static async saveClass(classDoc: any) {
    return classDoc.save();
  }

  static async bulkWriteAttendance(ops: unknown[]) {
    if (ops.length > 0) {
      await Attendance.bulkWrite(ops as any);
    }
  }

  static async findClassById(id: string, tenantId: string) {
    return Class.findOne({ _id: id, tenantId }).lean();
  }

  static async findStudentsGuardianIds(studentIds: unknown[], tenantId: string) {
    return Student.find({ _id: { $in: studentIds }, tenantId }).select('guardianId').lean();
  }

  static async findUsersByMemberIds(memberIds: unknown[], tenantId: string) {
    return User.find({ memberId: { $in: memberIds }, tenantId }).select('_id').lean();
  }

  static async insertNotifications(notifications: unknown[]) {
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  }

  static async findHomeworkByTeacher(tenantId: string, teacherId: unknown) {
    return Homework.find({ tenantId, teacherId })
      .populate('classId', 'name level')
      .populate('submissions.studentId', 'name admissionNo')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async createHomework(data: Record<string, unknown>) {
    return Homework.create(data);
  }

  static async findHomeworkForGrading(id: string, tenantId: string, teacherId: unknown) {
    return Homework.findOne({ _id: id, tenantId, teacherId });
  }

  static async saveHomework(homework: any) {
    return homework.save();
  }

  static async findExamsByClassIds(tenantId: string, classIds: unknown[]) {
    return Exam.find({ tenantId, classId: { $in: classIds } })
      .populate('classId', 'name level')
      .populate('results.studentId', 'name admissionNo')
      .sort({ date: -1 })
      .lean();
  }

  static async createExam(data: Record<string, unknown>) {
    return Exam.create(data);
  }

  static async findExamForResults(id: string, tenantId: string) {
    return Exam.findOne({ _id: id, tenantId });
  }

  static async saveExam(exam: any) {
    return exam.save();
  }

  static toObjectId(id: string) {
    return new mongoose.Types.ObjectId(id);
  }
}

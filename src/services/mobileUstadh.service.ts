import { MobileUstadhRepository as Repo } from '../repositories/mobileUstadh.repository';
import { User } from '../models/User';
import { Member } from '../models/Member';
import { Teacher } from '../models/Teacher';
import { Class } from '../models/Class';
import { Student } from '../models/Student';
import { Homework } from '../models/Homework';
import { Exam } from '../models/Exam';

type StatusResult = { status: number; body: Record<string, unknown> };

export class MobileUstadhService {
  /**
   * Helper: Resolve memberId & teacherId for current user
   */
  private static async resolveTeacherInfo(userId: string, tenantId: string) {
    const user = await User.findById(userId).select('memberId role email phone name').lean();
    if (!user) return { user: null, member: null, teacher: null };

    let memberId = user.memberId;
    let member = memberId ? await Member.findById(memberId).lean() : null;

    if (!member) {
      member = await Member.findOne({
        tenantId,
        $or: [{ userId }, { email: user.email }, { phone: user.phone }],
      }).lean();

      if (member) {
        memberId = member._id as any;
        await User.findByIdAndUpdate(userId, { memberId: member._id });
      }
    }

    let teacher = memberId ? await Teacher.findOne({ tenantId, memberId }).lean() : null;
    if (!teacher) {
      teacher = await Teacher.findOne({
        tenantId,
        $or: [{ memberId: userId }, { _id: memberId }],
      }).lean();
    }

    return { user, member, teacher };
  }

  static async getClasses(userId: string, tenantId: string) {
    const { user, member, teacher } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return [];

    const possibleTeacherIds = [
      teacher?._id,
      member?._id,
      user._id,
    ].filter(Boolean);

    let classes: any[] = [];
    if (possibleTeacherIds.length > 0) {
      classes = await Class.find({ tenantId, teacherId: { $in: possibleTeacherIds } })
        .populate({
          path: 'teacherId',
          select: 'employeeId memberId qualification subjects',
          populate: { path: 'memberId', select: 'name photo phone email' },
        })
        .lean();
    }

    // If Sadar Mualim, Madrasa Principal, or Super Admin, or if no class explicitly assigned
    if (classes.length === 0 && (user.role === 'sadar_mualim' || user.role === 'madrasa_principal' || user.role === 'super_admin')) {
      classes = await Class.find({ tenantId })
        .populate({
          path: 'teacherId',
          select: 'employeeId memberId qualification subjects',
          populate: { path: 'memberId', select: 'name photo phone email' },
        })
        .lean();
    }

    const classIds = classes.map((c: any) => c._id);

    const allStudents = await Student.find({
      tenantId,
      classId: { $in: classIds },
      status: 'active',
      isDeleted: { $ne: true },
    })
      .populate({ path: 'memberId', select: 'name photo phone gender memberId', options: { strictPopulate: false } })
      .populate({ path: 'familyId', select: 'familyCode headMemberId address', options: { strictPopulate: false } })
      .lean();

    const studentsByClass = new Map<string, any[]>();
    allStudents.forEach((s: any) => {
      const cid = s.classId?.toString() || '';
      if (!studentsByClass.has(cid)) studentsByClass.set(cid, []);
      studentsByClass.get(cid)!.push(s);
    });

    classes.forEach((c: any) => {
      c.students = studentsByClass.get(c._id.toString()) || [];
    });

    return classes;
  }

  static async updateTimetable(userId: string, tenantId: string, classIdParam: string, schedule: unknown): Promise<StatusResult> {
    if (!Array.isArray(schedule)) return { status: 400, body: { error: 'Schedule must be an array' } };

    const { user, teacher } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return { status: 403, body: { error: 'Unauthorized' } };

    if (classIdParam === 'direct-assigned' && teacher) {
      await Repo.setTeacherSchedule(teacher._id, schedule);
      return { status: 200, body: { success: true, data: { _id: 'direct-assigned', name: 'My Direct Students', schedule } } };
    }

    const classToUpdate = await Class.findOne({ _id: classIdParam, tenantId });
    if (!classToUpdate) return { status: 404, body: { error: 'Class not found' } };

    classToUpdate.schedule = schedule as any;
    await classToUpdate.save();

    return { status: 200, body: { success: true, data: classToUpdate } };
  }

  static async markAttendance(
    userId: string,
    tenantId: string,
    body: { classId?: string; date?: string; records?: any[] },
  ): Promise<StatusResult> {
    const { user } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const { classId, date, records } = body;
    if (!classId || !date || !records || !Array.isArray(records)) {
      return { status: 400, body: { success: false, message: 'Invalid data' } };
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const ops = records.map((record: any) => ({
      updateOne: {
        filter: {
          tenantId: Repo.toObjectId(tenantId),
          entityType: 'student' as const,
          entityId: Repo.toObjectId(record.studentId),
          classId: Repo.toObjectId(classId),
          date: attendanceDate,
        },
        update: {
          $set: {
            tenantId: Repo.toObjectId(tenantId),
            entityType: 'student' as const,
            entityId: Repo.toObjectId(record.studentId),
            classId: Repo.toObjectId(classId),
            date: attendanceDate,
            status: record.status,
            note: record.note,
            markedById: Repo.toObjectId(userId),
          },
        },
        upsert: true,
      },
    }));

    await Repo.bulkWriteAttendance(ops);

    return { status: 200, body: { success: true, message: 'Attendance marked successfully' } };
  }

  static async notify(
    userId: string,
    tenantId: string,
    body: { classId?: string; studentId?: string; title?: string; message?: string },
  ): Promise<StatusResult> {
    const { user } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const { classId, studentId, title, message } = body;
    if (!classId || !title || !message) {
      return { status: 400, body: { success: false, message: 'Missing fields' } };
    }

    const classData = await Repo.findClassById(classId, tenantId);
    if (!classData) return { status: 404, body: { success: false, message: 'Class not found' } };

    const targetStudentIds = studentId ? [studentId] : (classData as any).students;

    const students = await Repo.findStudentsGuardianIds(targetStudentIds, tenantId);
    const guardianIds = [...new Set(students.map((s: any) => s.guardianId?.toString()).filter(Boolean))];

    const usersToNotify = await Repo.findUsersByMemberIds(guardianIds, tenantId);

    const notifications = usersToNotify.map((u: any) => ({
      tenantId,
      channel: 'in_app',
      recipientId: u._id,
      title: `[${(classData as any).name}] ${title}`,
      body: message,
      status: 'pending',
    }));

    await Repo.insertNotifications(notifications);

    return { status: 200, body: { success: true, message: 'Notification sent successfully' } };
  }

  static async getHomework(userId: string, tenantId: string) {
    const { user, teacher } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return [];

    const teacherId = teacher?._id || userId;
    return Repo.findHomeworkByTeacher(tenantId, teacherId);
  }

  static async createHomework(
    userId: string,
    tenantId: string,
    body: { classId?: string; subject?: string; title?: string; description?: string; dueDate?: string },
  ): Promise<StatusResult> {
    const { user, teacher } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const { classId, subject, title, description, dueDate } = body;
    if (!classId || !subject || !title || !dueDate) {
      return { status: 400, body: { success: false, message: 'Missing required fields' } };
    }

    const teacherId = teacher?._id || userId;

    const homework = await Repo.createHomework({
      tenantId,
      classId,
      teacherId,
      subject,
      title,
      description,
      dueDate: new Date(dueDate),
    });

    return { status: 201, body: { success: true, data: homework } };
  }

  static async gradeHomework(
    userId: string,
    tenantId: string,
    homeworkId: string,
    body: { studentId?: string; grade?: string; feedback?: string },
  ): Promise<StatusResult> {
    const { user, teacher } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const { studentId, grade, feedback } = body;
    if (!studentId || !grade) {
      return { status: 400, body: { success: false, message: 'Missing fields' } };
    }

    const teacherId = teacher?._id || userId;
    const hw = await Repo.findHomeworkForGrading(homeworkId, tenantId, teacherId);
    if (!hw) return { status: 404, body: { success: false, message: 'Homework not found' } };

    const submissions = (hw as any).submissions || [];
    const existingIndex = submissions.findIndex((s: any) => s.studentId?.toString() === studentId);

    if (existingIndex >= 0) {
      submissions[existingIndex].grade = grade;
      submissions[existingIndex].feedback = feedback;
      submissions[existingIndex].status = 'graded';
    } else {
      submissions.push({
        studentId,
        submittedAt: new Date(),
        grade,
        feedback,
        status: 'graded',
      });
    }

    (hw as any).submissions = submissions;
    await Repo.saveHomework(hw);

    return { status: 200, body: { success: true, data: hw } };
  }

  static async getExams(userId: string, tenantId: string) {
    const classes = await this.getClasses(userId, tenantId);
    const classIds = classes.map((c: any) => c._id);
    return Repo.findExamsByClassIds(tenantId, classIds);
  }

  static async createExam(
    userId: string,
    tenantId: string,
    body: { classId?: string; title?: string; subjects?: string[]; date?: string; totalMarks?: number; passMark?: number },
  ): Promise<StatusResult> {
    const { user, teacher } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const { classId, title, subjects, date, totalMarks, passMark } = body;
    if (!classId || !title || !subjects || !date) {
      return { status: 400, body: { success: false, message: 'Missing required fields' } };
    }

    const teacherId = teacher?._id || userId;

    const exam = await Repo.createExam({
      tenantId,
      classId,
      createdBy: teacherId,
      title,
      subjects,
      date: new Date(date),
      totalMarks: totalMarks || 100,
      passMark: passMark || 40,
    });

    return { status: 201, body: { success: true, data: exam } };
  }

  static async saveExamResults(
    userId: string,
    tenantId: string,
    examId: string,
    body: { results?: Array<{ studentId: string; marksObtained: number; remarks?: string }> },
  ): Promise<StatusResult> {
    const { user } = await this.resolveTeacherInfo(userId, tenantId);
    if (!user) return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const { results } = body;
    if (!results || !Array.isArray(results)) {
      return { status: 400, body: { success: false, message: 'Missing results array' } };
    }

    const exam = await Repo.findExamForResults(examId, tenantId);
    if (!exam) return { status: 404, body: { success: false, message: 'Exam not found' } };

    const passMark = (exam as any).passMark || 40;
    const formattedResults = results.map((r) => ({
      studentId: r.studentId,
      marksObtained: r.marksObtained,
      isPassed: r.marksObtained >= passMark,
      remarks: r.remarks,
    }));

    (exam as any).results = formattedResults;
    await Repo.saveExam(exam);

    return { status: 200, body: { success: true, data: exam } };
  }
}

import { MobileUstadhRepository as Repo } from '../repositories/mobileUstadh.repository';

// This entire domain preserves its manual role checks EXACTLY as they were
// in the original monolithic mobile.routes.ts, per an explicit decision NOT
// to swap them for authorize()/authorizeRoles() middleware (which would
// change behavior — see the getClasses/getHomework/getExams 200-vs-403
// inconsistency and the DB-fresh-vs-JWT-cached role check noted below).
//
// Every check re-fetches the user's role fresh from MongoDB
// (findUserRoleAndMemberId) rather than trusting req.user.role from the
// JWT — meaning a role change takes effect immediately, unlike
// authorizeRoles() which is JWT-cached. This is intentional and preserved.

type StatusResult = { status: number; body: Record<string, unknown> };

export class MobileUstadhService {
  // NOTE: Teacher is looked up with .select('_id') only, so
  // `teacher.assignedStudents` is always undefined here — the
  // "My Direct Students" pseudo-class block below is unreachable dead
  // code in the original implementation. Preserved verbatim.
  static async getClasses(userId: string, tenantId: string) {
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return [];

    const teacher = await Repo.findTeacherId(tenantId, user.memberId);
    if (!teacher) return [];

    const classes = await Repo.findClassesByTeacher(tenantId, teacher._id);
    const classIds = classes.map((c: any) => c._id);

    const allStudents = await Repo.findActiveStudentsByClassIds(tenantId, classIds);
    const studentsByClass = new Map<string, any[]>();
    allStudents.forEach((s: any) => {
      const cid = s.classId?.toString() || '';
      if (!studentsByClass.has(cid)) studentsByClass.set(cid, []);
      studentsByClass.get(cid)!.push(s);
    });

    classes.forEach((c: any) => {
      c.students = studentsByClass.get(c._id.toString()) || [];
    });

    if ((teacher as any).assignedStudents && (teacher as any).assignedStudents.length > 0) {
      const directStudents = await Repo.findDirectAssignedStudents((teacher as any).assignedStudents);
      if (directStudents.length > 0) {
        classes.push({
          _id: 'direct-assigned',
          name: 'My Direct Students',
          students: directStudents,
          schedule: (teacher as any).schedule || [],
        } as any);
      }
    }

    return classes;
  }

  static async updateTimetable(userId: string, tenantId: string, classIdParam: string, schedule: unknown): Promise<StatusResult> {
    if (!Array.isArray(schedule)) return { status: 400, body: { error: 'Schedule must be an array' } };

    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return { status: 403, body: { error: 'Unauthorized' } };

    const teacher = await Repo.findTeacherId(tenantId, user.memberId);
    if (!teacher) return { status: 403, body: { error: 'Unauthorized' } };

    if (classIdParam === 'direct-assigned') {
      await Repo.setTeacherSchedule(teacher._id, schedule);
      return { status: 200, body: { success: true, data: { _id: 'direct-assigned', name: 'My Direct Students', schedule } } };
    }

    const classToUpdate = await Repo.findClassForTeacher(classIdParam, tenantId, teacher._id);
    if (!classToUpdate) return { status: 404, body: { error: 'Class not found' } };

    (classToUpdate as any).schedule = schedule;
    await Repo.saveClass(classToUpdate);

    return { status: 200, body: { success: true, data: classToUpdate } };
  }

  static async markAttendance(
    userId: string,
    tenantId: string,
    body: { classId?: string; date?: string; records?: any[] },
  ): Promise<StatusResult> {
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return { status: 403, body: { success: false, message: 'Unauthorized' } };

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
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return { status: 403, body: { success: false, message: 'Unauthorized' } };

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
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return [];

    const teacher = await Repo.findTeacherId(tenantId, user.memberId);
    if (!teacher) return [];

    return Repo.findHomeworkByTeacher(tenantId, teacher._id);
  }

  static async createHomework(
    userId: string,
    tenantId: string,
    body: { classId?: string; subject?: string; title?: string; description?: string; dueDate?: string },
  ): Promise<StatusResult> {
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const teacher = await Repo.findTeacherId(tenantId, user.memberId);
    if (!teacher) return { status: 403, body: { success: false, message: 'Teacher profile not found' } };

    const { classId, subject, title, description, dueDate } = body;
    if (!classId || !subject || !title || !dueDate) {
      return { status: 400, body: { success: false, message: 'Missing required fields' } };
    }

    const newHomework = await Repo.createHomework({
      tenantId,
      classId,
      teacherId: teacher._id,
      subject,
      title,
      description,
      dueDate,
      attachments: [],
      submissions: [],
    });

    return { status: 200, body: { success: true, data: newHomework, message: 'Homework assigned successfully' } };
  }

  static async gradeHomework(
    userId: string,
    tenantId: string,
    homeworkId: string,
    body: { studentId?: string; grade?: unknown; feedback?: unknown },
  ): Promise<StatusResult> {
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const teacher = await Repo.findTeacherId(tenantId, user.memberId);
    if (!teacher) return { status: 403, body: { success: false, message: 'Teacher profile not found' } };

    const { studentId, grade, feedback } = body;
    if (!studentId || grade === undefined) {
      return { status: 400, body: { success: false, message: 'Missing required fields' } };
    }

    const homework = await Repo.findHomeworkForGrading(homeworkId, tenantId, teacher._id);
    if (!homework) return { status: 404, body: { success: false, message: 'Homework not found' } };

    const submissionIndex = (homework as any).submissions.findIndex((s: any) => s.studentId?.toString() === studentId);
    if (submissionIndex >= 0) {
      (homework as any).submissions[submissionIndex].grade = grade;
      (homework as any).submissions[submissionIndex].feedback = feedback;
      (homework as any).submissions[submissionIndex].gradedAt = new Date();
    } else {
      (homework as any).submissions.push({
        studentId,
        submittedAt: new Date(),
        attachments: [],
        grade,
        feedback,
        gradedAt: new Date(),
      });
    }

    await Repo.saveHomework(homework);
    return { status: 200, body: { success: true, message: 'Grade saved successfully' } };
  }

  static async getExams(userId: string, tenantId: string) {
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return [];

    const teacher = await Repo.findTeacherIdAndAssignedStudents(tenantId, user.memberId);
    if (!teacher) return [];

    const classes = await Repo.findClassesByTeacher(tenantId, teacher._id);
    const classIds = classes.map((c: any) => c._id);

    return Repo.findExamsByClassIds(tenantId, classIds);
  }

  static async createExam(
    userId: string,
    tenantId: string,
    body: { classId?: string; title?: string; subjects?: unknown; date?: string; totalMarks?: number; passMark?: number },
  ): Promise<StatusResult> {
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const teacher = await Repo.findTeacherIdAndMadrasaId(tenantId, user.memberId);
    if (!teacher) return { status: 403, body: { success: false, message: 'Teacher profile not found' } };

    const { classId, title, subjects, date, totalMarks, passMark } = body;
    if (!classId || !title || !subjects || !date || !totalMarks || !passMark) {
      return { status: 400, body: { success: false, message: 'Missing required fields' } };
    }

    const newExam = await Repo.createExam({
      tenantId,
      madrasaId: (teacher as any).madrasaId || tenantId,
      classId,
      title,
      subjects,
      date,
      totalMarks,
      passMark,
      results: [],
      isPublished: false,
    });

    return { status: 200, body: { success: true, data: newExam, message: 'Exam created successfully' } };
  }

  static async saveExamResults(
    userId: string,
    tenantId: string,
    examId: string,
    body: {
      studentId?: string;
      marks?: unknown;
      totalObtained?: unknown;
      percentage?: unknown;
      grade?: unknown;
      isPassed?: unknown;
      remarks?: unknown;
    },
  ): Promise<StatusResult> {
    const user = await Repo.findUserRoleAndMemberId(userId);
    if (!user?.memberId || user.role !== 'ustadh') return { status: 403, body: { success: false, message: 'Unauthorized' } };

    const { studentId, marks, totalObtained, percentage, grade, isPassed, remarks } = body;
    if (!studentId || marks === undefined) {
      return { status: 400, body: { success: false, message: 'Missing required fields' } };
    }

    const exam = await Repo.findExamForResults(examId, tenantId);
    if (!exam) return { status: 404, body: { success: false, message: 'Exam not found' } };

    const resultIndex = (exam as any).results.findIndex((r: any) => r.studentId?.toString() === studentId);
    const newResult = { studentId, marks, totalObtained, percentage, grade, isPassed, remarks };

    if (resultIndex >= 0) {
      (exam as any).results[resultIndex] = newResult;
    } else {
      (exam as any).results.push(newResult);
    }

    await Repo.saveExam(exam);
    return { status: 200, body: { success: true, message: 'Exam results saved successfully' } };
  }
}

import axios from 'axios';
import { PRAYER_TIMES_API } from '@mahallu/shared-config';
import { AppError } from '../middleware/errorHandler';
import { MobileGeneralRepository as Repo } from '../repositories/mobileGeneral.repository';
import { cleanEventDescription } from '../domain/eventTemplates';
import { calculateNextDueDate } from '../domain/billing';

type StatusResult = { status: number; body: Record<string, unknown> };

export class MobileGeneralService {
  static async getProfile(userId: string, tenantId: string): Promise<StatusResult> {
    const user = await Repo.findUserFull(userId);
    if (!user) return { status: 404, body: { success: false, message: 'User not found' } };

    const member = user.memberId ? await Repo.findMemberFull(user.memberId) : null;
    const family = member?.familyId ? await Repo.findFamilyPopulatedShort(member.familyId) : null;
    const tenant = await Repo.findTenantBasic(tenantId);

    return { status: 200, body: { success: true, data: { user, member, family, tenant } } };
  }

  static async getFamily(userId: string) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) return null;

    const member = await Repo.findMemberFamilyId(user.memberId);
    if (!member?.familyId) return null;

    return Repo.findFamilyPopulatedDetailed(member.familyId);
  }

  static async updateFamily(
    userId: string,
    body: {
      line1?: string;
      wardNo?: string;
      recurringDonationType?: string;
      recurringDonationAmount?: unknown;
      recurringPaymentDay?: unknown;
      recurringPaymentMonth?: unknown;
    },
  ) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) throw new AppError('Member account not found', 404);

    const member = await Repo.findMemberFamilyId(user.memberId);
    if (!member?.familyId) throw new AppError('Family not found', 404);

    const { line1, wardNo, recurringDonationType, recurringDonationAmount, recurringPaymentDay, recurringPaymentMonth } = body;

    const updateFields: Record<string, unknown> = {};
    if (line1 !== undefined) updateFields['address.line1'] = line1;
    if (wardNo !== undefined) updateFields.wardNo = wardNo;
    if (recurringDonationType !== undefined) updateFields.recurringDonationType = recurringDonationType;
    if (recurringDonationAmount !== undefined) updateFields.recurringDonationAmount = Number(recurringDonationAmount) || 0;
    if (recurringPaymentDay !== undefined) updateFields.recurringPaymentDay = Number(recurringPaymentDay) || 1;
    if (recurringPaymentMonth !== undefined) updateFields.recurringPaymentMonth = Number(recurringPaymentMonth) || 1;

    const nextPaymentDueDate = calculateNextDueDate(
      (recurringDonationType as any) ?? 'none',
      Number(recurringPaymentDay) || 1,
      Number(recurringPaymentMonth) || 1,
    );
    updateFields.nextPaymentDueDate = nextPaymentDueDate || null;

    return Repo.updateFamilyFieldsDetailed(member.familyId, updateFields);
  }

  static async updateMember(
    userId: string,
    tenantId: string,
    targetMemberId: string,
    body: {
      name?: string;
      phone?: string;
      gender?: string;
      relationship?: string;
      occupation?: string;
      qualification?: string;
      bloodGroup?: string;
      dateOfBirth?: string;
      aadhaarNumber?: string;
    },
  ) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) throw new AppError('Member account not found', 404);

    const callerMember = await Repo.findMemberFamilyId(user.memberId);
    if (!callerMember?.familyId) throw new AppError('Family not found', 404);

    const targetMember = await Repo.findMemberDocByIdAndTenant(targetMemberId, tenantId);
    if (!targetMember) throw new AppError('Member not found', 404);

    if ((targetMember as any).familyId?.toString() !== callerMember.familyId.toString()) {
      throw new AppError('Unauthorized: Member does not belong to your family', 403);
    }

    const { name, phone, gender, relationship, occupation, qualification, bloodGroup, dateOfBirth, aadhaarNumber } = body;

    if (name) (targetMember as any).name = name;
    if (phone) (targetMember as any).phone = phone;
    if (gender) (targetMember as any).gender = gender;
    if (relationship) (targetMember as any).relationship = relationship;
    if (occupation !== undefined) (targetMember as any).occupation = occupation;
    if (qualification !== undefined) (targetMember as any).qualification = qualification;
    if (bloodGroup !== undefined) (targetMember as any).bloodGroup = bloodGroup;
    if (aadhaarNumber !== undefined) (targetMember as any).aadhaarNumber = aadhaarNumber;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime())) (targetMember as any).dateOfBirth = d;
    }

    await Repo.saveMember(targetMember);

    if (relationship) {
      await Repo.updateFamilyMemberRelationship(callerMember.familyId, (targetMember as any)._id, relationship);
    }

    if ((targetMember as any).userId) {
      const userUpdates: Record<string, unknown> = {};
      if (name) userUpdates.name = name;
      if (phone) userUpdates.phone = phone;
      if (Object.keys(userUpdates).length > 0) {
        await Repo.updateUserFields((targetMember as any).userId, userUpdates);
      }
    }

    return targetMember;
  }

  static async getPayments(userId: string, tenantId: string, query: { page?: string | number; limit?: string | number }) {
    const { page = 1, limit = 20 } = query;
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 50);

    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) {
      return { data: [] as unknown[], pagination: { page: 1, limit: limitNum, total: 0, totalPages: 0 } };
    }

    const filter = { tenantId, paidById: user.memberId };
    const [payments, total] = await Promise.all([
      Repo.findPaymentsPaginated(filter, (pageNum - 1) * limitNum, limitNum),
      Repo.countPayments(filter),
    ]);

    return { data: payments, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  static async getDonations(userId: string, tenantId: string) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) return [];
    return Repo.findDonationsByDonor(tenantId, user.memberId);
  }

  static async getNotifications(userId: string, tenantId: string) {
    return Repo.findNotificationsForUser(tenantId, userId);
  }

  static async getDues(userId: string, tenantId: string) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) return [];

    const member = await Repo.findMemberFamilyId(user.memberId);
    if (!member?.familyId) return [];

    return Repo.findPendingDues(tenantId, member.familyId);
  }

  // NOTE: identical dead-schedule-enrichment quirk to mobileUstadh's
  // getClasses — teacher is looked up with .select('schedule') only, so
  // this branch DOES apply (unlike the ustadh case, 'schedule' IS the
  // field selected here), preserved verbatim either way.
  static async getStudent(userId: string, tenantId: string) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) return null;

    const student: any = await Repo.findStudentFull(tenantId, user.memberId);

    if (student) {
      const teacher = await Repo.findTeacherScheduleByAssignedStudent(tenantId, student._id);

      if (teacher && (teacher as any).schedule && (!student.classId || !student.classId.schedule)) {
        if (!student.classId) student.classId = {};
        student.classId.schedule = (teacher as any).schedule;
        student.classId.name = student.classId.name || 'Directly Assigned';
      }
    }

    return student;
  }

  static async getStudentAttendance(userId: string, tenantId: string, query: { month?: string; year?: string }) {
    const { month, year } = query;
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) return [];

    const student = await Repo.findStudentIdOnly(tenantId, user.memberId);
    if (!student) return [];

    const now = new Date();
    const m = month ? parseInt(month) : now.getMonth();
    const y = year ? parseInt(year) : now.getFullYear();
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59);

    return Repo.findAttendanceRange(tenantId, student._id, startDate, endDate);
  }

  static async getStudentHomework(userId: string, tenantId: string) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) return [];

    const student = await Repo.findStudentClassAndId(tenantId, user.memberId);
    if (!student) return [];

    const homework = await Repo.findHomeworkByClass(tenantId, (student as any).classId);

    return homework.map((hw: any) => {
      const submission = hw.submissions?.find((s: any) => s.studentId?.toString() === student._id.toString());
      return { ...hw, mySubmission: submission || null };
    });
  }

  static async getStudentExams(userId: string, tenantId: string) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) return [];

    const student = await Repo.findStudentClassAndId(tenantId, user.memberId);
    if (!student) return [];

    const exams = await Repo.findPublishedExamsByClass(tenantId, (student as any).classId);

    return exams.map((exam: any) => {
      const myResult = exam.results?.find((r: any) => r.studentId?.toString() === student._id.toString());
      return { ...exam, results: undefined, myResult: myResult || null };
    });
  }

  // NOTE: N+1 query pattern (one Attendance/Homework/Teacher lookup set per
  // child, inside Promise.all but not batched across children) is a known
  // pre-existing inefficiency, preserved verbatim — fixing it is a deferred
  // follow-up per the approved Phase 5 plan, not part of this structural move.
  static async getChildren(userId: string, tenantId: string) {
    const user = await Repo.findUserMemberId(userId);
    if (!user?.memberId) return [];

    const children = await Repo.findChildren(tenantId, user.memberId);

    return Promise.all(
      children.map(async (child: any) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [attendanceRecords, pendingHomework, teacher] = await Promise.all([
          Repo.findChildAttendanceSince(tenantId, child._id, thirtyDaysAgo),
          Repo.countPendingHomeworkForChild(tenantId, child.classId, child._id),
          Repo.findTeacherScheduleByAssignedStudent(tenantId, child._id),
        ]);

        if (teacher && (teacher as any).schedule && (!child.classId || !child.classId.schedule)) {
          if (!child.classId) child.classId = {};
          child.classId.schedule = (teacher as any).schedule;
          child.classId.name = child.classId.name || 'Directly Assigned';
        }

        const presentCount = attendanceRecords.filter((a: any) => a.status === 'present' || a.status === 'late').length;
        const totalCount = attendanceRecords.length;
        const attendancePercent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

        return { ...child, attendancePercent, pendingHomework };
      }),
    );
  }

  static async getEvents(tenantId: string, query: { type?: string }) {
    const { type } = query;
    const now = new Date();
    const filter: Record<string, unknown> = { tenantId };

    if (type === 'past') {
      filter.date = { $lt: now };
    } else {
      filter.date = { $gte: now };
    }

    const events = await Repo.findEvents(filter, type === 'past' ? -1 : 1);
    return events.map((ev: any) => ({ ...ev, description: cleanEventDescription(ev) }));
  }

  static async getAnnouncements(tenantId: string) {
    return Repo.findAnnouncements(tenantId);
  }

  // Matches the original's own internal try/catch: any failure (tenant
  // lookup, Settings lookup, or the Aladhan API call) falls back to an
  // empty-but-still-200-success response, never propagates to the
  // controller's generic error handler.
  static async getPrayerTimes(tenantId: string, query: { lat?: string; lng?: string; method?: string }) {
    try {
      const tenant = await Repo.findTenantAddress(tenantId);
      const settings = await Repo.findSettings(tenantId);

      const lat = query.lat || (tenant as any)?.address?.gps?.coordinates?.[1] || 11.2588;
      const lng = query.lng || (tenant as any)?.address?.gps?.coordinates?.[0] || 75.7804;
      const method = query.method || 4;

      const { data } = await axios.get(`${PRAYER_TIMES_API}/timings`, {
        params: { latitude: lat, longitude: lng, method, timestamp: Math.floor(Date.now() / 1000) },
      });

      return { data: { timings: data.data?.timings || {}, iqamahTimes: (settings as any)?.iqamahTimes || {} } };
    } catch {
      return { data: { timings: {}, iqamahTimes: {} }, message: 'Prayer times unavailable' };
    }
  }

  static async getTeachers(tenantId: string) {
    return Repo.findActiveTeachers(tenantId);
  }

  static async getCertificates(userId: string, tenantId: string): Promise<StatusResult> {
    const user = await Repo.findUserFull(userId);
    if (!user || !(user as any).memberId) return { status: 403, body: { success: false, message: 'Member profile required' } };

    const [requests, issuedCerts] = await Promise.all([
      Repo.findCertificateRequests(tenantId, (user as any).memberId),
      Repo.findIssuedCertificates(tenantId, (user as any).memberId),
    ]);

    return { status: 200, body: { success: true, data: { requests, issuedCerts } } };
  }

  static async requestCertificate(
    userId: string,
    tenantId: string,
    body: { type?: string; purpose?: string; details?: Record<string, unknown> },
  ): Promise<StatusResult> {
    const user = await Repo.findUserFull(userId);
    if (!user || !(user as any).memberId) return { status: 403, body: { success: false, message: 'Member profile required' } };

    const { type, purpose, details } = body;
    if (!type || !purpose) return { status: 400, body: { success: false, message: 'Type and purpose are required' } };

    const certReq = await Repo.createCertificateRequest({
      tenantId,
      requestedBy: (user as any).memberId,
      type,
      purpose,
      details: details || {},
      status: 'PENDING',
    });

    return { status: 201, body: { success: true, data: certReq } };
  }

  static async getProperties(userId: string, tenantId: string): Promise<StatusResult> {
    const user = await Repo.findUserFull(userId);
    if (!user || !(user as any).memberId) return { status: 403, body: { success: false, message: 'Member profile required' } };

    const [properties, rentalHistory] = await Promise.all([
      Repo.findProperties(tenantId),
      Repo.findRentalHistory(tenantId, (user as any).memberId),
    ]);

    return { status: 200, body: { success: true, data: { properties, rentalHistory } } };
  }

  static async requestPropertyRental(
    userId: string,
    tenantId: string,
    body: { propertyId?: string; quantityRequested?: number; purpose?: string; startDate?: string; endDate?: string },
  ): Promise<StatusResult> {
    const user = await Repo.findUserFull(userId);
    if (!user || !(user as any).memberId) return { status: 403, body: { success: false, message: 'Member profile required' } };

    const { propertyId, quantityRequested, purpose, startDate, endDate } = body;
    if (!propertyId || !quantityRequested) {
      return { status: 400, body: { success: false, message: 'Property and quantity are required' } };
    }

    const reqDoc = await Repo.createRentalRequest({
      tenantId,
      requestedBy: (user as any).memberId,
      propertyId,
      quantityRequested,
      purpose,
      startDate,
      endDate,
      status: 'PENDING',
    });

    return { status: 201, body: { success: true, data: reqDoc } };
  }

  static async getFamilyStudents(userId: string, tenantId: string): Promise<StatusResult> {
    const user = await Repo.findUserFull(userId);
    if (!user || !(user as any).memberId) {
      return { status: 403, body: { success: false, message: 'Member profile required' } };
    }

    const member = await Repo.findMemberFull((user as any).memberId);
    if (!member || !(member as any).familyId) return { status: 200, body: { success: true, data: [] } };

    const family: any = await Repo.findFamilyPlain((member as any).familyId);
    if (!family) return { status: 200, body: { success: true, data: [] } };

    const memberIds = family.members.map((m: any) => m.memberId);
    const students = await Repo.findFamilyStudents(tenantId, memberIds);

    const aggregated = [];
    for (const student of students as any[]) {
      const attendanceLogs = await Repo.findStudentAttendanceLogs(tenantId, student._id);

      const total = attendanceLogs.length;
      const present = attendanceLogs.filter((a: any) => a.status === 'present').length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

      const homeworks = student.classId ? await Repo.findHomeworkForClassLimited(tenantId, student.classId._id) : [];
      const exams = student.classId ? await Repo.findExamsForClassLimited(tenantId, student.classId._id) : [];
      const notices = await Repo.findPushNotices(tenantId);

      aggregated.push({
        studentInfo: student,
        attendance: { total, present, percentage, logs: attendanceLogs },
        homeworks,
        exams,
        notices,
      });
    }

    return { status: 200, body: { success: true, data: aggregated } };
  }
}

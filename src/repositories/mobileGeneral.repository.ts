import { User } from '../models/User';
import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { Payment } from '../models/Payment';
import { Donation } from '../models/Donation';
import { Notification } from '../models/Notification';
import { Student } from '../models/Student';
import { Attendance } from '../models/Attendance';
import { Homework } from '../models/Homework';
import { Exam } from '../models/Exam';
import { Event } from '../models/Event';
import { Teacher } from '../models/Teacher';
import { Tenant } from '../models/Tenant';
import { Certificate } from '../models/Certificate';
import { CertificateRequest } from '../models/CertificateRequest';
import { Property } from '../models/Property';
import { RentalRequest } from '../models/RentalRequest';
import { Settings } from '../models/Settings';

const FAMILY_HEAD_SELECT_SHORT = 'name phone photo';
const FAMILY_MEMBER_SELECT_SHORT = 'name phone photo gender dateOfBirth occupation relationship status';
const FAMILY_HEAD_SELECT_DETAILED = 'name phone photo email gender dateOfBirth occupation qualification bloodGroup';
const FAMILY_MEMBER_SELECT_DETAILED = 'name phone photo email gender dateOfBirth occupation qualification bloodGroup status memberId';

export class MobileGeneralRepository {
  static async findUserFull(userId: string) {
    return User.findById(userId).lean();
  }

  static async findUserMemberId(userId: string) {
    return User.findById(userId).select('memberId').lean();
  }

  static async findMemberFull(memberId: unknown) {
    return Member.findById(memberId).lean();
  }

  static async findMemberFamilyId(memberId: unknown) {
    return Member.findById(memberId).select('familyId').lean();
  }

  static async findFamilyPopulatedShort(familyId: unknown) {
    return Family.findById(familyId)
      .populate('headMemberId', FAMILY_HEAD_SELECT_SHORT)
      .populate('members.memberId', FAMILY_MEMBER_SELECT_SHORT)
      .lean();
  }

  static async findFamilyPlain(familyId: unknown) {
    return Family.findById(familyId).lean();
  }

  static async findFamilyPopulatedDetailed(familyId: unknown) {
    return Family.findById(familyId)
      .populate('headMemberId', FAMILY_HEAD_SELECT_DETAILED)
      .populate('members.memberId', FAMILY_MEMBER_SELECT_DETAILED)
      .lean();
  }

  static async findTenantBasic(tenantId: string) {
    return Tenant.findById(tenantId).select('name mahalluCode logo address phone email').lean();
  }

  static async updateFamilyFieldsDetailed(familyId: unknown, updateFields: Record<string, unknown>) {
    return Family.findByIdAndUpdate(familyId, { $set: updateFields }, { new: true })
      .populate('headMemberId', FAMILY_HEAD_SELECT_DETAILED)
      .populate('members.memberId', FAMILY_MEMBER_SELECT_DETAILED)
      .lean();
  }

  static async findMemberDocByIdAndTenant(memberId: string, tenantId: string) {
    return Member.findOne({ _id: memberId, tenantId });
  }

  static async saveMember(member: any) {
    return member.save();
  }

  static async updateFamilyMemberRelationship(familyId: unknown, memberId: unknown, relationship: string) {
    await Family.updateOne({ _id: familyId, 'members.memberId': memberId }, { $set: { 'members.$.relationship': relationship } });
  }

  static async updateUserFields(userId: unknown, updates: Record<string, unknown>) {
    await User.findByIdAndUpdate(userId, { $set: updates });
  }

  static async findPaymentsPaginated(filter: Record<string, unknown>, skip: number, limit: number) {
    return Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  static async countPayments(filter: Record<string, unknown>) {
    return Payment.countDocuments(filter);
  }

  static async findDonationsByDonor(tenantId: string, donorId: unknown) {
    return Donation.find({ tenantId, donorId }).sort({ createdAt: -1 }).limit(50).lean();
  }

  static async findNotificationsForUser(tenantId: string, userId: string) {
    return Notification.find({
      tenantId,
      $or: [{ recipientId: userId }, { recipientId: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  static async findPendingDues(tenantId: string, familyId: unknown) {
    return Donation.find({ tenantId, familyId, status: 'pending' }).sort({ createdAt: 1 }).lean();
  }

  static async findStudentFull(tenantId: string, memberId: unknown) {
    return Student.findOne({ tenantId, memberId, isDeleted: { $ne: true } })
      .populate('memberId', 'name photo phone email gender dateOfBirth bloodGroup')
      .populate('classId', 'name schedule')
      .populate('madrasaId', 'name')
      .populate('guardianId', 'name phone photo')
      .lean();
  }

  static async findTeacherScheduleByAssignedStudent(tenantId: string, studentId: unknown) {
    return Teacher.findOne({ tenantId, assignedStudents: studentId }).select('schedule').lean();
  }

  static async findStudentIdOnly(tenantId: string, memberId: unknown) {
    return Student.findOne({ tenantId, memberId }).select('_id').lean();
  }

  static async findAttendanceRange(tenantId: string, studentId: unknown, startDate: Date, endDate: Date) {
    return Attendance.find({
      tenantId,
      entityType: 'student',
      entityId: studentId,
      date: { $gte: startDate, $lte: endDate },
    })
      .sort({ date: 1 })
      .lean();
  }

  static async findStudentClassAndId(tenantId: string, memberId: unknown) {
    return Student.findOne({ tenantId, memberId }).select('classId _id').lean();
  }

  static async findHomeworkByClass(tenantId: string, classId: unknown) {
    return Homework.find({ tenantId, classId }).populate('teacherId', 'memberId').sort({ dueDate: -1 }).limit(30).lean();
  }

  static async findPublishedExamsByClass(tenantId: string, classId: unknown) {
    return Exam.find({ tenantId, classId, isPublished: true }).sort({ date: -1 }).lean();
  }

  static async findChildren(tenantId: string, guardianId: unknown) {
    return Student.find({ tenantId, guardianId, isDeleted: { $ne: true } })
      .populate('memberId', 'name photo phone gender dateOfBirth')
      .populate('classId', 'name schedule')
      .populate('madrasaId', 'name')
      .lean();
  }

  static async findChildAttendanceSince(tenantId: string, childId: unknown, since: Date) {
    return Attendance.find({ tenantId, entityType: 'student', entityId: childId, date: { $gte: since } }).lean();
  }

  static async countPendingHomeworkForChild(tenantId: string, classId: unknown, childId: unknown) {
    return Homework.countDocuments({
      tenantId,
      classId,
      dueDate: { $gte: new Date() },
      'submissions.studentId': { $ne: childId },
    });
  }

  static async findEvents(filter: Record<string, unknown>, sortDir: 1 | -1) {
    return Event.find(filter).sort({ date: sortDir }).limit(20).lean();
  }

  static async findAnnouncements(tenantId: string) {
    return Notification.find({
      tenantId,
      recipientId: { $exists: false },
      status: { $in: ['sent', 'delivered'] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
  }

  static async findTenantAddress(tenantId: string) {
    return Tenant.findById(tenantId).select('address').lean();
  }

  static async findSettings(tenantId: string) {
    return Settings.findOne({ tenantId }).lean();
  }

  static async findActiveTeachers(tenantId: string) {
    return Teacher.find({ tenantId, status: 'active' })
      .populate('memberId', 'name photo phone email')
      .populate('madrasaId', 'name')
      .select('memberId madrasaId subjects qualification employeeId')
      .lean();
  }

  static async findCertificateRequests(tenantId: string, memberId: unknown) {
    return CertificateRequest.find({ tenantId, requestedBy: memberId }).sort({ createdAt: -1 }).populate('certificateId').lean();
  }

  static async findIssuedCertificates(tenantId: string, memberId: unknown) {
    return Certificate.find({ tenantId, recipientId: memberId }).sort({ issuedAt: -1 }).lean();
  }

  static async createCertificateRequest(data: Record<string, unknown>) {
    return CertificateRequest.create(data);
  }

  static async findProperties(tenantId: string) {
    return Property.find({ tenantId }).sort({ createdAt: -1 }).lean();
  }

  static async findRentalHistory(tenantId: string, memberId: unknown) {
    return RentalRequest.find({ tenantId, requestedBy: memberId }).populate('propertyId').sort({ createdAt: -1 }).lean();
  }

  static async createRentalRequest(data: Record<string, unknown>) {
    return RentalRequest.create(data);
  }

  static async findFamilyStudents(tenantId: string, memberIds: unknown[]) {
    return Student.find({ tenantId, memberId: { $in: memberIds }, isDeleted: { $ne: true } })
      .populate({ path: 'memberId', select: 'name photo phone gender', options: { strictPopulate: false } })
      .populate({ path: 'classId', select: 'name level', options: { strictPopulate: false } })
      .lean();
  }

  static async findStudentAttendanceLogs(tenantId: string, studentId: unknown) {
    return Attendance.find({ tenantId, entityId: studentId }).select('date status').sort({ date: -1 }).lean();
  }

  static async findHomeworkForClassLimited(tenantId: string, classId: unknown) {
    return Homework.find({ tenantId, classId }).sort({ dueDate: -1 }).limit(10).lean();
  }

  static async findExamsForClassLimited(tenantId: string, classId: unknown) {
    return Exam.find({ tenantId, classId }).sort({ date: -1 }).limit(10).lean();
  }

  static async findPushNotices(tenantId: string) {
    return Notification.find({ tenantId, channel: 'push' }).sort({ createdAt: -1 }).limit(5).lean();
  }
}

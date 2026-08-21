import { User } from '../models/User';
import { Family } from '../models/Family';
import { Member } from '../models/Member';
import { Student } from '../models/Student';
import { Class } from '../models/Class';

export class MobileSadarRepository {
  static async findUser(userId: string) {
    return User.findById(userId).lean();
  }

  static async findFamiliesWithHead(tenantId: string) {
    return Family.find({ tenantId, isDeleted: { $ne: true } }).populate('headMemberId', 'name').lean();
  }

  static async findMembersByFamily(familyId: string, tenantId: string) {
    return Member.find({ familyId, tenantId, isDeleted: false }).lean();
  }

  static async findActiveStudentsByMemberIds(memberIds: unknown[], tenantId: string) {
    return Student.find({ memberId: { $in: memberIds }, tenantId, status: 'active' }).populate('classId', 'name').lean();
  }

  static async findAllClasses(tenantId: string) {
    return Class.find({ tenantId }).lean();
  }

  static async findFamilyWithHead(familyId: string, tenantId: string) {
    return Family.findOne({ _id: familyId, tenantId }).populate('headMemberId');
  }

  static async findClassById(classId: string, tenantId: string) {
    return Class.findOne({ _id: classId, tenantId });
  }

  static async createMember(data: Record<string, unknown>) {
    return Member.create(data);
  }

  static async saveFamily(family: any) {
    return family.save();
  }

  static async findStudentByMember(memberId: unknown, tenantId: string) {
    return Student.findOne({ memberId, tenantId });
  }

  static async saveStudent(student: any) {
    return student.save();
  }

  static async createStudent(data: Record<string, unknown>) {
    return Student.create(data);
  }

  static async addStudentToClass(classId: unknown, studentId: unknown) {
    await Class.findByIdAndUpdate(classId, { $addToSet: { students: studentId } });
  }
}

import { RegistrationRequest, RegistrationStatus } from '../models/RegistrationRequest';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { Student } from '../models/Student';
import { Teacher } from '../models/Teacher';

export class RegistrationRepository {
  static async findTenantByMahalluCode(mahalluCode: string) {
    return Tenant.findOne({ mahalluCode });
  }

  static async createRegistrationRequest(data: Record<string, unknown>) {
    return RegistrationRequest.create(data);
  }

  static async findFamiliesByTenant(tenantId: string) {
    return Family.find({ tenantId, isDeleted: { $ne: true } })
      .populate('headMemberId', 'name')
      .lean();
  }

  static async findPendingRegistrations(tenantId: string) {
    return RegistrationRequest.find({
      tenantId,
      status: RegistrationStatus.PENDING,
    }).sort({ createdAt: -1 });
  }

  static async findRegistrationByIdAndTenant(id: string, tenantId: string) {
    return RegistrationRequest.findOne({ _id: id, tenantId });
  }

  static async createMember(data: Record<string, unknown>) {
    return Member.create(data);
  }

  static async findFamilyById(id: string) {
    return Family.findById(id);
  }

  static async createFamily(data: Record<string, unknown>) {
    return Family.create(data);
  }

  static async updateManyMembersSetFamilyId(memberIds: unknown[], familyId: unknown) {
    await Member.updateMany({ _id: { $in: memberIds } }, { $set: { familyId } });
  }

  static async createStudent(data: Record<string, unknown>) {
    return Student.create(data);
  }

  static async createTeacher(data: Record<string, unknown>) {
    return Teacher.create(data);
  }

  static async findUserByTenantAndPhone(tenantId: string, phone: string) {
    return User.findOne({ tenantId, phone });
  }

  static async createUser(data: Record<string, unknown>) {
    return User.create(data);
  }
}

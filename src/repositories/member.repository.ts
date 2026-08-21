import { Member } from '../models/Member';
import { Family } from '../models/Family';
import { User } from '../models/User';

export class MemberRepository {
  static async findMembers(filter: Record<string, unknown>, skip: number, limit: number) {
    return Member.find(filter)
      .populate('familyId', 'familyCode headMemberId address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async countMembers(filter: Record<string, unknown>) {
    return Member.countDocuments(filter);
  }

  static async findMemberById(id: string, tenantId: string) {
    return Member.findOne({ _id: id, tenantId, isDeleted: { $ne: true } })
      .populate('familyId userId')
      .lean();
  }

  static async countMembersByTenant(tenantId: string) {
    return Member.countDocuments({ tenantId });
  }

  static async createMember(data: Record<string, unknown>) {
    return Member.create(data);
  }

  static async pushMemberIntoFamily(
    familyId: string,
    tenantId: string,
    memberEntry: { memberId: unknown; relationship: string; isHead: boolean },
  ) {
    await Family.findOneAndUpdate({ _id: familyId, tenantId }, { $push: { members: memberEntry } });
  }

  static async findMemberByIdAndTenant(id: string, tenantId: string) {
    return Member.findOne({ _id: id, tenantId });
  }

  static async updateMember(id: string, tenantId: string, data: Record<string, unknown>) {
    return Member.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, runValidators: true },
    );
  }

  static async pullMemberFromFamily(familyId: string, tenantId: string, memberId: unknown) {
    await Family.findOneAndUpdate({ _id: familyId, tenantId }, { $pull: { members: { memberId } } });
  }

  static async updateMemberRelationshipInFamily(
    familyId: string,
    tenantId: string,
    memberId: unknown,
    relationship: string,
  ) {
    await Family.findOneAndUpdate(
      { _id: familyId, tenantId, 'members.memberId': memberId },
      { $set: { 'members.$.relationship': relationship } },
    );
  }

  static async deleteMemberById(id: string, tenantId: string) {
    return Member.findOneAndDelete({ _id: id, tenantId });
  }

  static async softDeleteMemberById(id: string, tenantId: string) {
    await Member.findOneAndUpdate(
      { _id: id, tenantId },
      { isDeleted: true, deletedAt: new Date(), status: 'inactive' },
    );
  }

  static async deactivateUser(userId: unknown) {
    await User.findByIdAndUpdate(userId, { isDeleted: true, isActive: false });
  }

  static async pullMemberFromAllFamilies(tenantId: string, memberId: string) {
    await Family.updateMany({ tenantId }, { $pull: { members: { memberId } } });
  }

  static async findMembersByIdsAndTenant(ids: string[], tenantId: string) {
    return Member.find({ _id: { $in: ids }, tenantId });
  }

  static async hardDeleteMembersByIds(ids: unknown[], tenantId: string) {
    await Member.deleteMany({ _id: { $in: ids }, tenantId });
  }

  static async softDeleteMembersByIds(ids: unknown[]) {
    await Member.updateMany({ _id: { $in: ids } }, { isDeleted: true, deletedAt: new Date(), status: 'inactive' });
  }

  static async deactivateUsersByIds(ids: unknown[]) {
    await User.updateMany({ _id: { $in: ids } }, { isDeleted: true, isActive: false });
  }

  static async pullMembersFromAllFamilies(tenantId: string, ids: unknown[]) {
    await Family.updateMany({ tenantId }, { $pull: { members: { memberId: { $in: ids } } } });
  }

  static async findMemberByIdAndTenantWithFamilyAddress(id: string, tenantId: string) {
    return Member.findOne({ _id: id, tenantId })
      .populate('familyId', 'address wardNo')
      .lean();
  }

  static async updateMemberQrCode(id: unknown, qrCode: string) {
    await Member.findByIdAndUpdate(id, { qrCode });
  }

  static async searchMembers(tenantId: string, q: string) {
    return Member.find({
      tenantId,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { memberId: { $regex: q, $options: 'i' } },
        { aadhaarNumber: { $regex: q, $options: 'i' } },
      ],
    }).limit(20).lean();
  }
}

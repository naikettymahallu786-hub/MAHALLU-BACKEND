import { Family } from '../models/Family';
import { Member } from '../models/Member';
import { User } from '../models/User';
import { Notification } from '../models/Notification';

export class FamilyRepository {
  static async findMatchingMemberIds(tenantId: string, orConditions: Record<string, unknown>[]) {
    const matches = await Member.find({ tenantId, $or: orConditions }).select('_id').lean();
    return matches.map((m) => m._id);
  }

  static async findAllByFilterSorted(filter: Record<string, unknown>) {
    return Family.find(filter)
      .populate('headMemberId', 'name phone email photo gender memberId')
      .populate('members.memberId', 'name phone')
      .sort({ familyCode: 1 })
      .collation({ locale: 'en', numericOrdering: true })
      .lean();
  }

  static async findAllPaginated(filter: Record<string, unknown>, sort: Record<string, 1 | -1>, skip: number, limit: number) {
    return Family.find(filter)
      .populate('headMemberId', 'name phone photo')
      .populate('members.memberId', 'name phone photo')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async count(filter: Record<string, unknown>) {
    return Family.countDocuments(filter);
  }

  static async findHeadMemberFallback(familyId: unknown) {
    return Member.findOne({ familyId, isDeleted: { $ne: true } }).select('name phone photo').lean();
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Family.findOne({ _id: id, tenantId }).populate('headMemberId members.memberId').lean();
  }

  static async create(data: Record<string, unknown>) {
    return Family.create(data);
  }

  static async updateByIdAndTenant(id: string, tenantId: string, data: Record<string, unknown>) {
    return Family.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true });
  }

  static async softDeleteByIdAndTenant(id: string, tenantId: string) {
    await Family.findOneAndUpdate({ _id: id, tenantId }, { isDeleted: true, deletedAt: new Date() });
  }

  static async restoreAllForTenant(tenantId: string) {
    return Family.updateMany({ tenantId, isDeleted: true }, { $set: { isDeleted: false }, $unset: { deletedAt: 1 } });
  }

  static async bulkUpdate(filter: Record<string, unknown>, update: Record<string, unknown>) {
    return Family.updateMany(filter, { $set: update });
  }

  static async findByIdAndTenantRaw(id: string, tenantId: string) {
    return Family.findOne({ _id: id, tenantId });
  }

  static async findUserByMemberAndTenant(memberId: unknown, tenantId: unknown) {
    return User.findOne({ memberId, tenantId });
  }

  static async createNotification(data: Record<string, unknown>) {
    return Notification.create(data);
  }
}

import { Student } from '../models/Student';
import { Member } from '../models/Member';

export class StudentRepository {
  static async findMatchingMemberIds(tenantId: string, search: string) {
    const matches = await Member.find({ tenantId, name: { $regex: search, $options: 'i' } }, '_id').lean();
    return matches.map((m) => m._id);
  }

  static async findAll(filter: Record<string, unknown>, skip: number, limit: number) {
    return Student.find(filter)
      .populate('memberId', 'name photo dateOfBirth gender phone')
      .populate('classId', 'name')
      .populate('guardianId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async count(filter: Record<string, unknown>) {
    return Student.countDocuments(filter);
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Student.findOne({ _id: id, tenantId }).populate('memberId classId guardianId').lean();
  }

  static async create(data: Record<string, unknown>) {
    return Student.create(data);
  }

  static async updateByIdAndTenant(id: string, tenantId: string, data: Record<string, unknown>) {
    return Student.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true });
  }

  static async softDeleteByIdAndTenant(id: string, tenantId: string) {
    await Student.findOneAndUpdate({ _id: id, tenantId }, { isDeleted: true, deletedAt: new Date() });
  }
}

import { Class } from '../models/Class';

export class ClassRepository {
  static async findAllByTenant(tenantId: string) {
    return Class.find({ tenantId })
      .populate({
        path: 'teacherId',
        select: 'employeeId memberId subjects qualification',
        populate: { path: 'memberId', select: 'name photo phone email' },
      })
      .sort({ level: 1 })
      .lean();
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Class.findOne({ _id: id, tenantId })
      .populate({
        path: 'teacherId',
        select: 'employeeId memberId subjects qualification',
        populate: { path: 'memberId', select: 'name photo phone email' },
      })
      .lean();
  }

  static async create(data: Record<string, unknown>) {
    return Class.create(data);
  }

  static async updateByIdAndTenant(id: string, tenantId: string, data: Record<string, unknown>) {
    return Class.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true })
      .populate({
        path: 'teacherId',
        select: 'employeeId memberId subjects qualification',
        populate: { path: 'memberId', select: 'name photo phone email' },
      });
  }
}

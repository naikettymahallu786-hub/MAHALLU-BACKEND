import { Teacher } from '../models/Teacher';

export class TeacherRepository {
  static async findAllByTenant(tenantId: string, skip: number = 0, limit: number = 1000) {
    return Teacher.find({ tenantId })
      .populate('memberId', 'name photo phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async countByTenant(tenantId: string) {
    return Teacher.countDocuments({ tenantId });
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Teacher.findOne({ _id: id, tenantId }).populate('memberId madrasaId').lean();
  }

  static async create(data: Record<string, unknown>) {
    return Teacher.create(data);
  }

  static async updateByIdAndTenant(id: string, tenantId: string, data: Record<string, unknown>) {
    return Teacher.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true }).populate('memberId', 'name photo phone email');
  }
}

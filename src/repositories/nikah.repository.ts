import { Nikah } from '../models/Nikah';

export class NikahRepository {
  static async findAllByTenant(tenantId: string) {
    return Nikah.find({ tenantId }).sort({ date: -1 }).lean();
  }

  static async count(tenantId: string) {
    return Nikah.countDocuments({ tenantId });
  }

  static async create(data: Record<string, unknown>) {
    return Nikah.create(data);
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Nikah.findOne({ _id: id, tenantId }).lean();
  }

  static async updateByIdAndTenant(id: string, tenantId: string, data: Record<string, unknown>) {
    return Nikah.findOneAndUpdate({ _id: id, tenantId }, { ...data }, { new: true });
  }

  static async deleteByIdAndTenant(id: string, tenantId: string) {
    await Nikah.deleteOne({ _id: id, tenantId });
  }
}

import { EventTemplate } from '../models/EventTemplate';

export class EventTemplateRepository {
  static async findAllByTenant(tenantId: string) {
    return EventTemplate.find({ tenantId }).sort({ createdAt: -1 }).lean();
  }

  static async insertMany(data: Record<string, unknown>[]) {
    await EventTemplate.insertMany(data);
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return EventTemplate.findOne({ _id: id, tenantId }).lean();
  }

  static async create(data: Record<string, unknown>) {
    return EventTemplate.create(data);
  }

  static async updateByIdAndTenant(id: string, tenantId: string, data: Record<string, unknown>) {
    return EventTemplate.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true });
  }

  static async deleteByIdAndTenant(id: string, tenantId: string) {
    await EventTemplate.deleteOne({ _id: id, tenantId });
  }
}

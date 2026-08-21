import { Event } from '../models/Event';

export class EventRepository {
  static async findAllByTenant(tenantId: string) {
    return Event.find({ tenantId })
      .populate('committeeMembers.memberId', 'name photo phone')
      .populate('registrations.memberId', 'name')
      .sort({ date: -1 })
      .lean();
  }

  static async findByIdAndTenant(id: string, tenantId: string) {
    return Event.findOne({ _id: id, tenantId })
      .populate('committeeMembers.memberId', 'name photo phone age gender occupation')
      .populate('registrations.memberId', 'name photo phone')
      .lean();
  }

  static async create(data: Record<string, unknown>) {
    return Event.create(data);
  }

  static async updateByIdAndTenant(id: string, tenantId: string, data: Record<string, unknown>) {
    return Event.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true });
  }

  static async pushRegistration(id: string, tenantId: string, registration: Record<string, unknown>) {
    await Event.updateOne({ _id: id, tenantId }, { $push: { registrations: registration } });
  }
}

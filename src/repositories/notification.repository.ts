import { Notification } from '../models/Notification';

export class NotificationRepository {
  static async findRecentByTenant(tenantId: string) {
    return Notification.find({ tenantId }).sort({ createdAt: -1 }).limit(50).lean();
  }

  static async create(data: Record<string, unknown>) {
    return Notification.create(data);
  }
}

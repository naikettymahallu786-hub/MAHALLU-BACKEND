import { NotificationRepository } from '../repositories/notification.repository';

export class NotificationService {
  static async getRecent(tenantId: string) {
    return NotificationRepository.findRecentByTenant(tenantId);
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    return NotificationRepository.create({ ...body, tenantId });
  }
}

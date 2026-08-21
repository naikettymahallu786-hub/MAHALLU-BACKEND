import { AuditLog } from '../models/AuditLog';

export class AuditLogRepository {
  static async findAllByTenant(tenantId: string, skip: number, limit: number) {
    return AuditLog.find({ tenantId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async countByTenant(tenantId: string) {
    return AuditLog.countDocuments({ tenantId });
  }
}

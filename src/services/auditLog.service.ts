import { AuditLogRepository } from '../repositories/auditLog.repository';
import { buildPaginationMeta } from '../domain/pagination';

export class AuditLogService {
  static async getAll(tenantId: string, query: { page?: string; limit?: string }) {
    const pageNum = parseInt(query.page as string) || 1;
    const limitNum = parseInt(query.limit as string) || 50;

    const [logs, total] = await Promise.all([
      AuditLogRepository.findAllByTenant(tenantId, (pageNum - 1) * limitNum, limitNum),
      AuditLogRepository.countByTenant(tenantId),
    ]);

    return { logs, pagination: buildPaginationMeta(pageNum, limitNum, total) };
  }
}

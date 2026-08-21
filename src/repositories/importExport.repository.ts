import { Family, Member, User, ImportExportLog, Tenant } from '../models';

export class ImportExportRepository {
  static async findLogsByTenant(tenantId: string) {
    return ImportExportLog.find({ tenantId }).sort({ createdAt: -1 }).limit(50);
  }

  static async createLog(data: Record<string, unknown>) {
    return ImportExportLog.create(data);
  }

  static async findLogById(id: string) {
    return ImportExportLog.findById(id).select('status');
  }

  static async updateLogStatus(id: string, tenantId: string, status: string) {
    return ImportExportLog.findOneAndUpdate({ _id: id, tenantId }, { status }, { new: true });
  }

  static async updateLogProgress(
    id: string,
    data: { totalRecords: number; successCount: number; failedCount: number; errorDetails: unknown[] },
  ) {
    await ImportExportLog.findByIdAndUpdate(id, data);
  }

  static async markLogCompleted(
    id: string,
    data: { totalRecords: number; successCount: number; failedCount: number; errorDetails: unknown[] },
  ) {
    await ImportExportLog.findByIdAndUpdate(id, { status: 'COMPLETED', ...data });
  }

  static async markLogFailed(id: string, errorDetails: unknown[]) {
    await ImportExportLog.findByIdAndUpdate(id, { status: 'FAILED', errorDetails });
  }

  static async findTenantById(id: string) {
    return Tenant.findById(id);
  }

  static async findFamiliesByTenant(tenantId: string) {
    return Family.find({ tenantId });
  }

  static async findFamiliesByTenantPopulated(tenantId: string) {
    return Family.find({ tenantId }).populate('members.memberId');
  }

  static async findMembersByTenant(tenantId: string) {
    return Member.find({ tenantId });
  }

  static async findUsersByTenant(tenantId: string) {
    return User.find({ tenantId });
  }

  static async createFamily(data: Record<string, unknown>) {
    return Family.create(data);
  }

  static async createMember(data: Record<string, unknown>) {
    return Member.create(data);
  }

  static async findUserByTenantAndOr(tenantId: string, orConditions: Record<string, unknown>[]) {
    return User.findOne({ tenantId, $or: orConditions });
  }

  static async createUser(data: Record<string, unknown>) {
    return User.create(data);
  }
}

import { DeathRepository } from '../repositories/death.repository';

export class DeathService {
  static async getAll(tenantId: string) {
    return DeathRepository.findAllByTenant(tenantId);
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    return DeathRepository.create({ ...body, tenantId });
  }
}

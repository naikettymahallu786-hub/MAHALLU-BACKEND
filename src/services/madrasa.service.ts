import { MadrasaRepository } from '../repositories/madrasa.repository';

export class MadrasaService {
  static async getForTenant(tenantId: string) {
    return MadrasaRepository.findByTenant(tenantId);
  }

  static async upsertForTenant(tenantId: string, body: Record<string, unknown>) {
    return MadrasaRepository.upsertForTenant(tenantId, body);
  }
}

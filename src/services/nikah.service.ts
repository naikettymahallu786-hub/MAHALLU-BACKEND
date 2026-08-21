import { NikahRepository } from '../repositories/nikah.repository';
import { generateSequentialId } from '../domain/idGenerator';

export class NikahService {
  static async getAll(tenantId: string) {
    return NikahRepository.findAllByTenant(tenantId);
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    const count = await NikahRepository.count(tenantId);
    const nikahNo = generateSequentialId('NKH', count, { padWidth: 4 });
    return NikahRepository.create({ ...body, tenantId, nikahNo });
  }

  // No AppError here on purpose — the pre-existing controller returned a
  // raw 404 JSON body directly instead of throwing, unlike every other
  // domain's not-found handling. Preserved as-is; the not-found check
  // itself lives in the controller so it can build that exact response.
  static async getById(id: string, tenantId: string) {
    return NikahRepository.findByIdAndTenant(id, tenantId);
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    return NikahRepository.updateByIdAndTenant(id, tenantId, body);
  }

  static async remove(id: string, tenantId: string) {
    await NikahRepository.deleteByIdAndTenant(id, tenantId);
  }
}

import axios from 'axios';
import { MosqueRepository } from '../repositories/mosque.repository';

export class MosqueService {
  static async getForTenant(tenantId: string) {
    return MosqueRepository.findByTenant(tenantId);
  }

  static async upsertForTenant(tenantId: string, body: Record<string, unknown>) {
    return MosqueRepository.upsertForTenant(tenantId, body);
  }

  static async getPrayerTimes(query: { lat?: string; lng?: string; method?: string | number }) {
    const { lat = '11.0168', lng = '76.9558', method = 1 } = query;
    const date = new Date();
    const response = await axios.get(
      `https://api.aladhan.com/v1/timings/${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}?latitude=${lat}&longitude=${lng}&method=${method}`,
    );
    return response.data.data.timings;
  }
}

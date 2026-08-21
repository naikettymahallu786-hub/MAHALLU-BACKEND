import { AppError } from '../middleware/errorHandler';
import { EventTemplateRepository } from '../repositories/eventTemplate.repository';
import { MASTER_TEMPLATES } from '../domain/eventTemplateSeeds';

export class EventTemplateService {
  // Self-seeding: a GET with a write side effect, preserved exactly as
  // found rather than "fixed" into a separate seed step.
  static async getAll(tenantId: string) {
    let templates = await EventTemplateRepository.findAllByTenant(tenantId);

    if (templates.length === 0) {
      const seedData = MASTER_TEMPLATES.map((t) => ({ ...t, tenantId }));
      await EventTemplateRepository.insertMany(seedData);
      templates = await EventTemplateRepository.findAllByTenant(tenantId);
    }

    return templates;
  }

  static async getById(id: string, tenantId: string) {
    const template = await EventTemplateRepository.findByIdAndTenant(id, tenantId);
    if (!template) throw new AppError('Template not found', 404);
    return template;
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    return EventTemplateRepository.create({ ...body, tenantId });
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    const template = await EventTemplateRepository.updateByIdAndTenant(id, tenantId, body);
    if (!template) throw new AppError('Template not found', 404);
    return template;
  }

  static async remove(id: string, tenantId: string) {
    await EventTemplateRepository.deleteByIdAndTenant(id, tenantId);
  }
}

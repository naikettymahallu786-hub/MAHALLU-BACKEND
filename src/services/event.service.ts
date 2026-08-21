import { AppError } from '../middleware/errorHandler';
import { EventRepository } from '../repositories/event.repository';
import { cleanEventDescription } from '../domain/eventTemplates';

export class EventService {
  static async getAll(tenantId: string) {
    const events = await EventRepository.findAllByTenant(tenantId);
    return events.map((ev: any) => ({ ...ev, description: cleanEventDescription(ev) }));
  }

  static async getById(id: string, tenantId: string) {
    const event = await EventRepository.findByIdAndTenant(id, tenantId);
    if (!event) throw new AppError('Event not found', 404);
    return { ...event, description: cleanEventDescription(event) };
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    const payload: Record<string, unknown> = { ...body, tenantId };
    if (payload.description) {
      payload.description = cleanEventDescription(payload);
    }
    return EventRepository.create(payload);
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    const updatePayload: Record<string, unknown> = { ...body };
    if (updatePayload.description) {
      updatePayload.description = cleanEventDescription(updatePayload);
    }
    return EventRepository.updateByIdAndTenant(id, tenantId, updatePayload);
  }

  static async register(id: string, tenantId: string, memberId: unknown) {
    await EventRepository.pushRegistration(id, tenantId, {
      memberId,
      registeredAt: new Date(),
      attended: false,
    });
  }
}

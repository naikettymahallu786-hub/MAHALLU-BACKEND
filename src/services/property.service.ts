import { AppError } from '../middleware/errorHandler';
import { PropertyRepository } from '../repositories/property.repository';
import { LeaseRepository } from '../repositories/lease.repository';
import { RentalRequestRepository } from '../repositories/rentalRequest.repository';
import { generateSequentialId } from '../domain/idGenerator';

export class PropertyService {
  static async getAll(tenantId: string) {
    return PropertyRepository.findAllByTenant(tenantId);
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    const count = await PropertyRepository.count(tenantId);
    const propertyCode = generateSequentialId('PROP', count, { includeYear: false, padWidth: 4 });

    const payload: Record<string, unknown> = { ...body };
    if (payload.type === 'equipment' && payload.quantity !== undefined) {
      payload.availableQuantity = payload.quantity;
    }

    return PropertyRepository.create({ ...payload, tenantId, propertyCode });
  }

  static async getLeases(tenantId: string, propertyId: string) {
    return LeaseRepository.findByPropertyAndTenant(tenantId, propertyId);
  }

  static async createLease(tenantId: string, propertyId: string, body: Record<string, unknown>) {
    const lease = await LeaseRepository.create({ ...body, tenantId, propertyId });
    await PropertyRepository.setCurrentLeaseAndOccupied(propertyId, lease._id);
    return lease;
  }

  static async getAllRequests(tenantId: string) {
    return RentalRequestRepository.findAllByTenant(tenantId);
  }

  static async getRequestById(id: string, tenantId: string) {
    const request = await RentalRequestRepository.findByIdAndTenant(id, tenantId);
    if (!request) throw new AppError('Request not found', 404);
    return request;
  }

  static async approveRequest(id: string, tenantId: string) {
    const request = await RentalRequestRepository.findByIdAndTenantRaw(id, tenantId);
    if (!request) throw new AppError('Request not found', 404);

    if (request.status !== 'PENDING') {
      throw new AppError('Request is already processed', 400);
    }

    const property = await PropertyRepository.findByIdAndTenantRaw(String(request.propertyId), tenantId);
    if (property && property.type === 'equipment') {
      if ((property.availableQuantity || 0) < request.quantityRequested) {
        throw new AppError('Not enough quantity available', 400);
      }
      property.availableQuantity = (property.availableQuantity || 0) - request.quantityRequested;
      await property.save();
    }

    request.status = 'APPROVED';
    await request.save();

    return request;
  }

  static async rejectRequest(id: string, tenantId: string) {
    const request = await RentalRequestRepository.findByIdAndTenantRaw(id, tenantId);
    if (!request) throw new AppError('Request not found', 404);

    request.status = 'REJECTED';
    await request.save();
  }

  static async getById(id: string, tenantId: string) {
    const prop = await PropertyRepository.findByIdAndTenant(id, tenantId);
    if (!prop) throw new AppError('Property not found', 404);
    return prop;
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    const existing = await PropertyRepository.findByIdAndTenantRaw(id, tenantId);
    if (!existing) throw new AppError('Property not found', 404);

    const payload: Record<string, unknown> = { ...body };
    if (payload.type === 'equipment' && payload.quantity !== undefined) {
      const diff = (payload.quantity as number) - (existing.quantity || 0);
      payload.availableQuantity = (existing.availableQuantity || 0) + diff;
    }

    return PropertyRepository.updateByIdAndTenant(id, tenantId, payload);
  }
}

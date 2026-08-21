import { AppError } from '../middleware/errorHandler';
import { ClassRepository } from '../repositories/class.repository';
import { MadrasaRepository } from '../repositories/madrasa.repository';

export class ClassService {
  static async getAll(tenantId: string) {
    return ClassRepository.findAllByTenant(tenantId);
  }

  static async getById(id: string, tenantId: string) {
    const classData = await ClassRepository.findByIdAndTenant(id, tenantId);
    if (!classData) throw new AppError('Class not found', 404);
    return classData;
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    const madrasa = await MadrasaRepository.findByTenantRaw(tenantId);
    if (!madrasa) throw new AppError('Madrasa not found for this tenant', 404);

    const newClass = await ClassRepository.create({ ...body, tenantId, madrasaId: madrasa._id });

    madrasa.classes.push(newClass._id as any);
    await madrasa.save();

    return newClass;
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    return ClassRepository.updateByIdAndTenant(id, tenantId, body);
  }
}

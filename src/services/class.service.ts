import { AppError } from '../middleware/errorHandler';
import { ClassRepository } from '../repositories/class.repository';
import { MadrasaRepository } from '../repositories/madrasa.repository';
import { Madrasa } from '../models/Madrasa';

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
    let madrasa = await MadrasaRepository.findByTenantRaw(tenantId);
    if (!madrasa) {
      // Auto-create Madrasa record for tenant if not created yet
      madrasa = await Madrasa.create({
        tenantId,
        name: 'Mahallu Madrasa',
        academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        classes: [],
        subjects: ['Quran', 'Fiqh', 'Aqeedah', 'Akhlaq', 'Arabic', 'Thareekh'],
      });
    }

    const newClass = await ClassRepository.create({ ...body, tenantId, madrasaId: madrasa._id });

    madrasa.classes = madrasa.classes || [];
    madrasa.classes.push(newClass._id as any);
    await madrasa.save();

    return newClass;
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    return ClassRepository.updateByIdAndTenant(id, tenantId, body);
  }
}

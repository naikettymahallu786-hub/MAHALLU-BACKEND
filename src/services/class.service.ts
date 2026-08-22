import { AppError } from '../middleware/errorHandler';
import { ClassRepository } from '../repositories/class.repository';
import { Madrasa } from '../models/Madrasa';
import { Class } from '../models/Class';

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
    let madrasa = await Madrasa.findOne({ tenantId });
    if (!madrasa) {
      try {
        madrasa = await Madrasa.findOneAndUpdate(
          { tenantId },
          {
            $setOnInsert: {
              tenantId,
              name: 'Mahallu Madrasa',
              academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
              classes: [],
              subjects: ['Quran', 'Fiqh', 'Aqeedah', 'Akhlaq', 'Arabic', 'Thareekh'],
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (err) {
        madrasa = await Madrasa.findOne({ tenantId });
      }
    }

    if (!madrasa) {
      madrasa = await Madrasa.findOne({ tenantId });
    }

    const className = ((body.name as string) || '').trim();
    if (!className) {
      throw new AppError('Class name is required', 400);
    }

    // Check if class with the same name already exists for this tenant & madrasa
    const existingClass = await Class.findOne({ tenantId, madrasaId: madrasa!._id, name: className });
    if (existingClass) {
      // Update existing class with new teacher & attributes
      if (body.teacherId) existingClass.teacherId = body.teacherId as any;
      if (body.level) existingClass.level = Number(body.level) || 1;
      if (body.subjects) existingClass.subjects = body.subjects as string[];
      if (body.academicYear) existingClass.academicYear = body.academicYear as string;
      await existingClass.save();
      return ClassRepository.findByIdAndTenant((existingClass._id as any).toString(), tenantId);
    }

    const newClass = await ClassRepository.create({
      ...body,
      name: className,
      tenantId,
      madrasaId: madrasa!._id,
    });

    await Madrasa.updateOne({ _id: madrasa!._id }, { $addToSet: { classes: newClass._id } });

    return ClassRepository.findByIdAndTenant((newClass._id as any).toString(), tenantId);
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    return ClassRepository.updateByIdAndTenant(id, tenantId, body);
  }
}

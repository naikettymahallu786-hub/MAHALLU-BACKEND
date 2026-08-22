import QRCode from 'qrcode';
import { AppError } from '../middleware/errorHandler';
import { StudentRepository } from '../repositories/student.repository';
import { MadrasaRepository } from '../repositories/madrasa.repository';
import { Madrasa } from '../models/Madrasa';
import { buildPaginationMeta } from '../domain/pagination';
import { generateSequentialId } from '../domain/idGenerator';

export class StudentService {
  static async getAll(
    tenantId: string,
    query: { page?: string; limit?: string; classId?: string; status?: string; search?: string },
  ) {
    const { page = '1', limit = '20', classId, status, search } = query;
    const filter: Record<string, unknown> = { tenantId };
    if (classId) filter.classId = classId;
    if (status) filter.status = status;

    if (search) {
      const memberIds = await StudentRepository.findMatchingMemberIds(tenantId, search);
      filter.$or = [
        { admissionNo: { $regex: search, $options: 'i' } },
        { memberId: { $in: memberIds } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const [students, total] = await Promise.all([
      StudentRepository.findAll(filter, (pageNum - 1) * limitNum, limitNum),
      StudentRepository.count(filter),
    ]);

    return { students, pagination: buildPaginationMeta(pageNum, limitNum, total) };
  }

  static async getById(id: string, tenantId: string) {
    const student = await StudentRepository.findByIdAndTenant(id, tenantId);
    if (!student) throw new AppError('Student not found', 404);
    return student;
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    let madrasaId = body.madrasaId;
    if (!madrasaId) {
      let madrasa = await MadrasaRepository.findByTenantRaw(tenantId);
      if (!madrasa) {
        madrasa = await Madrasa.create({
          tenantId,
          name: 'Mahallu Madrasa',
          academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          classes: [],
          subjects: ['Quran', 'Fiqh', 'Aqeedah', 'Akhlaq', 'Arabic', 'Thareekh'],
        });
      }
      madrasaId = madrasa._id;
    }

    const count = await StudentRepository.count({ tenantId });
    const admissionNo = (body.admissionNo as string) || generateSequentialId('STD', count, { padWidth: 4 });
    const qrData = JSON.stringify({ admissionNo, tenantId, type: 'student' });
    const qrCode = await QRCode.toDataURL(qrData);
    return StudentRepository.create({ ...body, tenantId, madrasaId, admissionNo, qrCode });
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    const student = await StudentRepository.updateByIdAndTenant(id, tenantId, body);
    if (!student) throw new AppError('Student not found', 404);
    return student;
  }

  static async remove(id: string, tenantId: string) {
    await StudentRepository.softDeleteByIdAndTenant(id, tenantId);
  }
}

import { AppError } from '../middleware/errorHandler';
import { TeacherRepository } from '../repositories/teacher.repository';
import { MadrasaRepository } from '../repositories/madrasa.repository';
import { Madrasa } from '../models/Madrasa';
import { Member } from '../models/Member';
import { buildPaginationMeta } from '../domain/pagination';
import { generateSequentialId } from '../domain/idGenerator';

export class TeacherService {
  static async getAll(tenantId: string, query: { page?: string; limit?: string }) {
    const pageNum = parseInt(query.page as string) || 1;
    const limitNum = parseInt(query.limit as string) || 1000;

    const [teachers, total] = await Promise.all([
      TeacherRepository.findAllByTenant(tenantId, (pageNum - 1) * limitNum, limitNum),
      TeacherRepository.countByTenant(tenantId),
    ]);

    return { teachers, pagination: buildPaginationMeta(pageNum, limitNum, total) };
  }

  static async getById(id: string, tenantId: string) {
    const teacher = await TeacherRepository.findByIdAndTenant(id, tenantId);
    if (!teacher) throw new AppError('Teacher not found', 404);
    return teacher;
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

    let memberId = body.memberId;
    if (!memberId && body.name) {
      const memberCount = await Member.countDocuments({ tenantId });
      const memberCode = generateSequentialId('MEM', memberCount, { padWidth: 4 });
      const newMember = await Member.create({
        tenantId,
        memberCode,
        name: body.name,
        phone: body.phone || undefined,
        gender: body.gender || 'male',
        maritalStatus: 'single',
        membershipStatus: 'active',
      });
      memberId = newMember._id;
    }

    if (!memberId) {
      throw new AppError('Member or Teacher name is required', 400);
    }

    const count = await TeacherRepository.countByTenant(tenantId);
    const employeeId = generateSequentialId('EMP', count, { includeYear: false, padWidth: 4 });
    const qualification = (body.qualification as string) || 'Islamic Scholar / Usthadh';
    const salary = typeof body.salary === 'number' ? body.salary : 0;

    return TeacherRepository.create({
      ...body,
      tenantId,
      madrasaId,
      memberId,
      employeeId,
      qualification,
      salary,
    });
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    const teacher = await TeacherRepository.updateByIdAndTenant(id, tenantId, body);
    if (!teacher) throw new AppError('Teacher not found', 404);
    return teacher;
  }
}

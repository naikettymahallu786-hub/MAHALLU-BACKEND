import { AppError } from '../middleware/errorHandler';
import { TeacherRepository } from '../repositories/teacher.repository';
import { buildPaginationMeta } from '../domain/pagination';
import { generateSequentialId } from '../domain/idGenerator';

export class TeacherService {
  static async getAll(tenantId: string, query: { page?: string; limit?: string }) {
    const pageNum = parseInt(query.page as string) || 1;
    const limitNum = parseInt(query.limit as string) || 20;

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
    const count = await TeacherRepository.countByTenant(tenantId);
    const employeeId = generateSequentialId('EMP', count, { includeYear: false, padWidth: 4 });
    return TeacherRepository.create({ ...body, tenantId, employeeId });
  }

  static async update(id: string, tenantId: string, body: Record<string, unknown>) {
    const teacher = await TeacherRepository.updateByIdAndTenant(id, tenantId, body);
    if (!teacher) throw new AppError('Teacher not found', 404);
    return teacher;
  }
}

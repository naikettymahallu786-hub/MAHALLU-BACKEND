import { AppError } from '../middleware/errorHandler';
import { HomeworkRepository } from '../repositories/homework.repository';

export class HomeworkService {
  static async getAll(tenantId: string, classId?: unknown) {
    return HomeworkRepository.findAllByTenant(tenantId, classId);
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    return HomeworkRepository.create({ ...body, tenantId });
  }

  static async submit(id: string, tenantId: string, body: Record<string, unknown>) {
    const hw = await HomeworkRepository.addSubmission(id, tenantId, { ...body, submittedAt: new Date() });
    if (!hw) throw new AppError('Homework not found', 404);
    return hw;
  }

  static async grade(
    id: string,
    tenantId: string,
    { studentId, grade, feedback }: { studentId: unknown; grade: unknown; feedback: unknown },
  ) {
    await HomeworkRepository.gradeSubmission(id, tenantId, studentId, { grade, feedback, gradedAt: new Date() });
  }
}

import { ExamRepository } from '../repositories/exam.repository';

export class ExamService {
  static async getAll(tenantId: string, classId?: unknown) {
    return ExamRepository.findAllByTenant(tenantId, classId);
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    return ExamRepository.create({ ...body, tenantId });
  }

  // Preserves the exact pre-existing behavior: no not-found check — the
  // route returns `data: null` if the exam doesn't exist rather than a 404.
  static async updateResults(id: string, tenantId: string, body: { results: unknown; isPublished: unknown }) {
    return ExamRepository.updateResults(id, tenantId, {
      results: body.results,
      isPublished: body.isPublished,
    });
  }
}

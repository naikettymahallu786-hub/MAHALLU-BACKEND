import { Exam } from '../models/Exam';

export class ExamRepository {
  static async findAllByTenant(tenantId: string, classId?: unknown) {
    return Exam.find({ tenantId, ...(classId ? { classId } : {}) }).sort({ date: -1 }).lean();
  }

  static async create(data: Record<string, unknown>) {
    return Exam.create(data);
  }

  static async updateResults(
    id: string,
    tenantId: string,
    data: { results: unknown; isPublished: unknown },
  ) {
    return Exam.findOneAndUpdate({ _id: id, tenantId }, { $set: data }, { new: true });
  }
}

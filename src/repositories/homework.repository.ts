import { Homework } from '../models/Homework';

export class HomeworkRepository {
  static async findAllByTenant(tenantId: string, classId?: unknown) {
    return Homework.find({ tenantId, ...(classId ? { classId } : {}) })
      .populate('teacherId', 'memberId')
      .sort({ dueDate: 1 })
      .lean();
  }

  static async create(data: Record<string, unknown>) {
    return Homework.create(data);
  }

  static async addSubmission(id: string, tenantId: string, submission: Record<string, unknown>) {
    return Homework.findOneAndUpdate(
      { _id: id, tenantId },
      { $push: { submissions: submission } },
      { new: true },
    );
  }

  static async gradeSubmission(
    id: string,
    tenantId: string,
    studentId: unknown,
    data: { grade: unknown; feedback: unknown; gradedAt: Date },
  ) {
    await Homework.updateOne(
      { _id: id, tenantId, 'submissions.studentId': studentId },
      {
        $set: {
          'submissions.$.grade': data.grade,
          'submissions.$.feedback': data.feedback,
          'submissions.$.gradedAt': data.gradedAt,
        },
      },
    );
  }
}

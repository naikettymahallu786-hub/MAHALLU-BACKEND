import { Survey } from '../models/Survey';

export class SurveyRepository {
  static async findAllByTenant(tenantId: string) {
    return Survey.find({ tenantId }).lean();
  }

  static async create(data: Record<string, unknown>) {
    return Survey.create(data);
  }

  static async addResponse(id: string, tenantId: string, response: Record<string, unknown>) {
    await Survey.findOneAndUpdate({ _id: id, tenantId }, { $push: { responses: response } });
  }
}

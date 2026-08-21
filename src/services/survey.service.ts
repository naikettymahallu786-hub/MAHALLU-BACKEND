import { SurveyRepository } from '../repositories/survey.repository';

export class SurveyService {
  static async getAll(tenantId: string) {
    return SurveyRepository.findAllByTenant(tenantId);
  }

  static async create(tenantId: string, body: Record<string, unknown>) {
    return SurveyRepository.create({ ...body, tenantId });
  }

  static async respond(id: string, tenantId: string, body: Record<string, unknown>) {
    await SurveyRepository.addResponse(id, tenantId, { ...body, respondedAt: new Date() });
  }
}

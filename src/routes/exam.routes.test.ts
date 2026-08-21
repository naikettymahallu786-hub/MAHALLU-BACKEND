import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Exam } from '../models/Exam';

const app = createApp();

async function createExam(tenantId: any, overrides: Partial<Record<string, unknown>> = {}) {
  return Exam.create({
    tenantId,
    madrasaId: objectId(),
    classId: objectId(),
    title: 'Mid Term',
    date: new Date('2026-05-01'),
    totalMarks: 100,
    passMark: 40,
    ...overrides,
  });
}

describe('GET /api/v1/exams', () => {
  it('lists exams for the tenant, optionally filtered by classId', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const classA = objectId();
    await createExam(tenant._id, { classId: classA, date: new Date('2026-01-01') });
    await createExam(tenant._id, { date: new Date('2026-02-01') });

    const all = await request(app).get('/api/v1/exams').set('Authorization', `Bearer ${token}`);
    expect(all.body.data).toHaveLength(2);

    const filtered = await request(app)
      .get(`/api/v1/exams?classId=${classA.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(filtered.body.data).toHaveLength(1);
  });
});

describe('POST /api/v1/exams', () => {
  it('creates an exam scoped to the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/exams')
      .set('Authorization', `Bearer ${token}`)
      .send({
        madrasaId: objectId().toString(),
        classId: objectId().toString(),
        title: 'Final',
        date: '2026-06-01',
        totalMarks: 100,
        passMark: 40,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant._id.toString());
  });
});

describe('PUT /api/v1/exams/:id/results', () => {
  it('sets results and isPublished on the exam', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const exam = await createExam(tenant._id);
    const studentId = objectId();

    const res = await request(app)
      .put(`/api/v1/exams/${exam._id}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({ results: [{ studentId: studentId.toString(), totalObtained: 80 }], isPublished: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(true);
    expect(res.body.data.results).toHaveLength(1);
  });

  it('returns null data (no 404) when the exam does not exist — matches pre-existing behavior', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .put(`/api/v1/exams/${objectId()}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({ results: [], isPublished: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

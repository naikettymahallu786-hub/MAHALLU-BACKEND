import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Homework } from '../models/Homework';

const app = createApp();

async function createHomework(tenantId: any, overrides: Partial<Record<string, unknown>> = {}) {
  return Homework.create({
    tenantId,
    classId: objectId(),
    teacherId: objectId(),
    subject: 'Arabic',
    title: 'Chapter 3',
    dueDate: new Date('2026-05-01'),
    ...overrides,
  });
}

describe('GET /api/v1/homework', () => {
  it('lists homework for the tenant, optionally filtered by classId', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const classA = objectId();
    await createHomework(tenant._id, { classId: classA });
    await createHomework(tenant._id);

    const filtered = await request(app)
      .get(`/api/v1/homework?classId=${classA.toString()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(filtered.body.data).toHaveLength(1);
  });
});

describe('POST /api/v1/homework', () => {
  it('creates homework scoped to the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/homework')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: objectId().toString(), teacherId: objectId().toString(), subject: 'Fiqh', title: 'HW1', dueDate: '2026-05-10' });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant._id.toString());
  });
});

describe('POST /api/v1/homework/:id/submit', () => {
  it('pushes a submission and stamps submittedAt', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const hw = await createHomework(tenant._id);
    const studentId = objectId();

    const res = await request(app)
      .post(`/api/v1/homework/${hw._id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: studentId.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.submissions).toHaveLength(1);
    expect(res.body.data.submissions[0].submittedAt).toBeDefined();
  });

  it('returns 404 when the homework does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post(`/api/v1/homework/${objectId()}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: objectId().toString() });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/homework/:id/grade', () => {
  it('grades an existing submission', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const studentId = objectId();
    const hw = await createHomework(tenant._id, {
      submissions: [{ studentId, submittedAt: new Date() }],
    });

    const res = await request(app)
      .patch(`/api/v1/homework/${hw._id}/grade`)
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: studentId.toString(), grade: 90, feedback: 'Great' });

    expect(res.status).toBe(200);
    const updated = await Homework.findById(hw._id);
    expect(updated!.submissions[0].grade).toBe(90);
    expect(updated!.submissions[0].feedback).toBe('Great');
    expect(updated!.submissions[0].gradedAt).toBeDefined();
  });
});

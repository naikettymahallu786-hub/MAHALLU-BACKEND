import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Student } from '../models/Student';
import { Member } from '../models/Member';

const app = createApp();

async function createStudent(tenantId: any, overrides: Partial<Record<string, unknown>> = {}) {
  return Student.create({
    tenantId,
    admissionNo: `STD-${Math.floor(Math.random() * 1e6)}`,
    memberId: objectId(),
    madrasaId: objectId(),
    classId: objectId(),
    guardianId: objectId(),
    ...overrides,
  });
}

describe('GET /api/v1/students', () => {
  it('paginates and filters by classId/status', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const classA = objectId();
    await createStudent(tenant._id, { classId: classA, status: 'active' });
    await createStudent(tenant._id, { status: 'withdrawn' });

    const res = await request(app)
      .get(`/api/v1/students?classId=${classA.toString()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it('searches by admissionNo or by matching member name', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const member = await Member.create({
      tenantId: tenant._id,
      memberId: `MHL-${Math.floor(Math.random() * 1e8)}`,
      name: 'Searchable Student',
      gender: 'male',
      phone: `+9188888${Math.floor(Math.random() * 100000)}`,
    });
    await createStudent(tenant._id, { memberId: member._id });
    await createStudent(tenant._id);

    const res = await request(app)
      .get('/api/v1/students?search=Searchable')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/students/:id', () => {
  it('returns 404 when the student does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get(`/api/v1/students/${objectId()}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/students', () => {
  it('creates a student with a generated admissionNo and QR code', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        memberId: objectId().toString(),
        madrasaId: objectId().toString(),
        classId: objectId().toString(),
        guardianId: objectId().toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.admissionNo).toMatch(/^STD-\d{4}-\d{4}$/);
    expect(res.body.data.qrCode).toMatch(/^data:image/);
  });
});

describe('PUT /api/v1/students/:id', () => {
  it('returns 404 when the student does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .put(`/api/v1/students/${objectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'promoted' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/students/:id', () => {
  it('soft-deletes the student', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const student = await createStudent(tenant._id);

    const res = await request(app)
      .delete(`/api/v1/students/${student._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await Student.findById(student._id).setOptions({ includeDeleted: true });
    expect(updated!.isDeleted).toBe(true);
    expect(updated!.deletedAt).toBeDefined();
  });
});

import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Teacher } from '../models/Teacher';

const app = createApp();

async function createTeacher(tenantId: any, overrides: Partial<Record<string, unknown>> = {}) {
  return Teacher.create({
    tenantId,
    memberId: objectId(),
    madrasaId: objectId(),
    employeeId: `EMP-${Math.floor(Math.random() * 1e6)}`,
    qualification: 'BA',
    salary: 20000,
    ...overrides,
  });
}

describe('GET /api/v1/teachers', () => {
  it('paginates teachers for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createTeacher(tenant._id);
    await createTeacher(tenant._id);

    const res = await request(app).get('/api/v1/teachers').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });
});

describe('GET /api/v1/teachers/:id', () => {
  it('returns 404 when the teacher does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get(`/api/v1/teachers/${objectId()}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/teachers', () => {
  it('creates a teacher with a generated employeeId', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({ memberId: objectId().toString(), madrasaId: objectId().toString(), qualification: 'MA', salary: 25000 });

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toMatch(/^EMP-\d{4}$/);
  });
});

describe('PUT /api/v1/teachers/:id', () => {
  it('returns 404 when the teacher does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .put(`/api/v1/teachers/${objectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ salary: 30000 });

    expect(res.status).toBe(404);
  });

  it('updates a teacher', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const teacher = await createTeacher(tenant._id);

    const res = await request(app)
      .put(`/api/v1/teachers/${teacher._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ salary: 30000 });

    expect(res.status).toBe(200);
    expect(res.body.data.salary).toBe(30000);
  });
});

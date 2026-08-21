import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Zakat } from '../models/Zakat';

const app = createApp();

describe('GET /api/v1/zakat', () => {
  it('lists zakat records for the tenant sorted by year descending', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Zakat.create({ tenantId: tenant._id, year: 2024 });
    await Zakat.create({ tenantId: tenant._id, year: 2026 });

    const res = await request(app).get('/api/v1/zakat').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].year).toBe(2026);
    expect(res.body.data[1].year).toBe(2024);
  });
});

describe('POST /api/v1/zakat', () => {
  it('creates a zakat record scoped to the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/zakat')
      .set('Authorization', `Bearer ${token}`)
      .send({ year: 2026 });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant._id.toString());
  });
});

describe('POST /api/v1/zakat/:id/apply', () => {
  it('adds an applicant with status forced to pending', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const zakat = await Zakat.create({ tenantId: tenant._id, year: 2026 });
    const memberId = objectId();

    const res = await request(app)
      .post(`/api/v1/zakat/${zakat._id}/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({ memberId: memberId.toString(), amountRequested: 5000, status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.applicants).toHaveLength(1);
    expect(res.body.data.applicants[0].status).toBe('pending');
  });
});

describe('PATCH /api/v1/zakat/:id/applicants/:memberId', () => {
  it('updates an applicant\'s status and approved amount', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const memberId = objectId();
    const zakat = await Zakat.create({
      tenantId: tenant._id,
      year: 2026,
      applicants: [{ memberId, amountRequested: 5000, status: 'pending' }],
    });

    const res = await request(app)
      .patch(`/api/v1/zakat/${zakat._id}/applicants/${memberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved', amountApproved: 4000 });

    expect(res.status).toBe(200);
    const updated = await Zakat.findById(zakat._id);
    expect(updated!.applicants[0].status).toBe('approved');
    expect(updated!.applicants[0].amountApproved).toBe(4000);
  });
});

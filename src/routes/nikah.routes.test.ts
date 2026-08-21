import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Nikah } from '../models/Nikah';

const app = createApp();

function nikahPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    brideName: 'Aisha',
    brideFatherName: 'Bakr',
    groomName: 'Ali',
    groomFatherName: 'Talib',
    imamId: objectId().toString(),
    mehr: 5000,
    date: '2026-05-01',
    ...overrides,
  };
}

describe('GET /api/v1/nikah', () => {
  it('lists nikah records sorted by date descending', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Nikah.create({ tenantId: tenant._id, nikahNo: 'NKH-1', ...nikahPayload({ date: new Date('2026-01-01') }) });
    await Nikah.create({ tenantId: tenant._id, nikahNo: 'NKH-2', ...nikahPayload({ date: new Date('2026-06-01') }) });

    const res = await request(app).get('/api/v1/nikah').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].nikahNo).toBe('NKH-2');
  });
});

describe('POST /api/v1/nikah', () => {
  it('creates a nikah record with a generated nikahNo', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/nikah')
      .set('Authorization', `Bearer ${token}`)
      .send(nikahPayload());

    expect(res.status).toBe(201);
    expect(res.body.data.nikahNo).toMatch(/^NKH-\d{4}-\d{4}$/);
  });
});

describe('GET /api/v1/nikah/:id', () => {
  it('returns a raw 404 body (not the standard AppError shape) when not found', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get(`/api/v1/nikah/${objectId()}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Nikah entry not found' });
  });
});

describe('PUT /api/v1/nikah/:id', () => {
  it('updates a nikah record', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const n = await Nikah.create({ tenantId: tenant._id, nikahNo: 'NKH-1', ...nikahPayload() });

    const res = await request(app)
      .put(`/api/v1/nikah/${n._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ venue: 'Main Masjid' });

    expect(res.status).toBe(200);
    expect(res.body.data.venue).toBe('Main Masjid');
  });
});

describe('DELETE /api/v1/nikah/:id', () => {
  it('deletes a nikah record', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const n = await Nikah.create({ tenantId: tenant._id, nikahNo: 'NKH-1', ...nikahPayload() });

    const res = await request(app).delete(`/api/v1/nikah/${n._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(await Nikah.findById(n._id)).toBeNull();
  });
});

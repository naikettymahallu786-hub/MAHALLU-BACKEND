import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser } from '../__tests__/helpers';
import { Madrasa } from '../models/Madrasa';

const app = createApp();

describe('GET /api/v1/madrasa', () => {
  it('returns the tenant\'s madrasa (or null if none exists)', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/madrasa').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('POST /api/v1/madrasa', () => {
  it('upserts the tenant\'s madrasa', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const first = await request(app)
      .post('/api/v1/madrasa')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Al-Huda Madrasa' });
    expect(first.status).toBe(200);
    expect(first.body.data.name).toBe('Al-Huda Madrasa');

    const second = await request(app)
      .post('/api/v1/madrasa')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Madrasa' });
    expect(second.body.data.name).toBe('Renamed Madrasa');

    const count = await Madrasa.countDocuments({ tenantId: tenant._id });
    expect(count).toBe(1);
  });
});

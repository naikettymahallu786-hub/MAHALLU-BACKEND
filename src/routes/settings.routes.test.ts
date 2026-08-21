import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser } from '../__tests__/helpers';
import { Settings } from '../models/Settings';

const app = createApp();

describe('GET /api/v1/settings', () => {
  it('returns the tenant\'s settings (or null if none exists)', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/settings').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('PUT /api/v1/settings', () => {
  it('upserts the tenant\'s settings', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const first = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: { mode: 'dark' } });
    expect(first.status).toBe(200);

    const second = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: { mode: 'light' } });
    expect(second.body.data.theme.mode).toBe('light');

    const count = await Settings.countDocuments({ tenantId: tenant._id });
    expect(count).toBe(1);
  });
});

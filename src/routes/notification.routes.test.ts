import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser } from '../__tests__/helpers';
import { Notification } from '../models/Notification';

const app = createApp();

describe('GET /api/v1/notices', () => {
  it('lists the tenant\'s most recent 50 notifications, newest first', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Notification.create({ tenantId: tenant._id, channel: 'in_app', title: 'A', body: 'first' });
    await Notification.create({ tenantId: tenant._id, channel: 'in_app', title: 'B', body: 'second' });

    const res = await request(app).get('/api/v1/notices').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].title).toBe('B');
  });
});

describe('POST /api/v1/notices', () => {
  it('creates a notification scoped to the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/notices')
      .set('Authorization', `Bearer ${token}`)
      .send({ channel: 'in_app', title: 'New Notice', body: 'Hello everyone' });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant._id.toString());
    const stored = await Notification.findById(res.body.data._id);
    expect(stored).not.toBeNull();
  });
});

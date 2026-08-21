import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { DeathRecord } from '../models/DeathRecord';

const app = createApp();

describe('GET /api/v1/death', () => {
  it('lists death records for the tenant sorted by dateOfDeath descending', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const memberId = objectId();
    await DeathRecord.create({ tenantId: tenant._id, memberId, dateOfDeath: new Date('2026-01-01') });
    await DeathRecord.create({ tenantId: tenant._id, memberId, dateOfDeath: new Date('2026-06-01') });

    const res = await request(app).get('/api/v1/death').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(new Date(res.body.data[0].dateOfDeath).getTime()).toBeGreaterThan(
      new Date(res.body.data[1].dateOfDeath).getTime(),
    );
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/death');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/death', () => {
  it('creates a death record scoped to the caller\'s tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const memberId = objectId();

    const res = await request(app)
      .post('/api/v1/death')
      .set('Authorization', `Bearer ${token}`)
      .send({ memberId: memberId.toString(), dateOfDeath: '2026-03-15' });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant._id.toString());
    const stored = await DeathRecord.findById(res.body.data._id);
    expect(stored).not.toBeNull();
  });
});

import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { AuditLog } from '../models/AuditLog';

const app = createApp();

describe('GET /api/v1/audit-logs', () => {
  it('paginates audit logs for the tenant, newest first', async () => {
    const tenant = await createTenant();
    const { token, user } = await createAuthedUser(tenant._id);
    await AuditLog.create({
      tenantId: tenant._id,
      userId: user._id,
      action: 'CREATE',
      entity: 'Member',
      entityId: objectId(),
    });
    await AuditLog.create({
      tenantId: tenant._id,
      userId: user._id,
      action: 'UPDATE',
      entity: 'Member',
      entityId: objectId(),
    });

    const res = await request(app).get('/api/v1/audit-logs').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].action).toBe('UPDATE');
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 50, total: 2 });
  });
});

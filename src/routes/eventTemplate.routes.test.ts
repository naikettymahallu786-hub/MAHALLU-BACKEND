import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { EventTemplate } from '../models/EventTemplate';

const app = createApp();

describe('GET /api/v1/event-templates', () => {
  it('auto-seeds the 2 master templates on first call for a tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/event-templates').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((t: any) => t.isMasterTemplate)).toBe(true);
  });

  it('does not re-seed on a second call', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    await request(app).get('/api/v1/event-templates').set('Authorization', `Bearer ${token}`);
    const second = await request(app).get('/api/v1/event-templates').set('Authorization', `Bearer ${token}`);

    expect(second.body.data).toHaveLength(2);
  });

  it('does not seed when the tenant already has a custom template', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await EventTemplate.create({
      tenantId: tenant._id,
      name: 'Custom',
      noticeTemplateText: 'Hello',
    });

    const res = await request(app).get('/api/v1/event-templates').set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/event-templates/:id', () => {
  it('returns 404 when the template does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .get(`/api/v1/event-templates/${objectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/event-templates', () => {
  it('creates a custom template scoped to the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/event-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Template', noticeTemplateText: 'Hi {{NAME}}' });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant._id.toString());
  });
});

describe('PUT /api/v1/event-templates/:id', () => {
  it('returns 404 when the template does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .put(`/api/v1/event-templates/${objectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('updates a template', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const template = await EventTemplate.create({
      tenantId: tenant._id,
      name: 'Old',
      noticeTemplateText: 'Hi',
    });

    const res = await request(app)
      .put(`/api/v1/event-templates/${template._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New');
  });
});

describe('DELETE /api/v1/event-templates/:id', () => {
  it('deletes a template', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const template = await EventTemplate.create({
      tenantId: tenant._id,
      name: 'Old',
      noticeTemplateText: 'Hi',
    });

    const res = await request(app)
      .delete(`/api/v1/event-templates/${template._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await EventTemplate.findById(template._id)).toBeNull();
  });
});

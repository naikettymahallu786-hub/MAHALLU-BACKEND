import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Madrasa } from '../models/Madrasa';
import { Class } from '../models/Class';

const app = createApp();

describe('GET /api/v1/classes', () => {
  it('lists classes for the tenant sorted by level', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const madrasaId = objectId();
    await Class.create({ tenantId: tenant._id, madrasaId, name: 'B', level: 2 });
    await Class.create({ tenantId: tenant._id, madrasaId, name: 'A', level: 1 });

    const res = await request(app).get('/api/v1/classes').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((c: any) => c.name)).toEqual(['A', 'B']);
  });
});

describe('GET /api/v1/classes/:id', () => {
  it('returns 404 when the class does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get(`/api/v1/classes/${objectId()}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/classes', () => {
  it('creates a class under the tenant\'s madrasa and registers it on the madrasa', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const madrasa = await Madrasa.create({ tenantId: tenant._id, name: 'Al-Huda' });

    const res = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Grade 1', level: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.madrasaId).toBe(madrasa._id.toString());

    const updatedMadrasa = await Madrasa.findById(madrasa._id);
    expect(updatedMadrasa!.classes.map((id) => id.toString())).toContain(res.body.data._id);
  });

  it('returns 404 when the tenant has no madrasa yet', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Grade 1', level: 1 });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/classes/:id', () => {
  it('updates a class', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const cls = await Class.create({ tenantId: tenant._id, madrasaId: objectId(), name: 'Old', level: 1 });

    const res = await request(app)
      .put(`/api/v1/classes/${cls._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New');
  });
});

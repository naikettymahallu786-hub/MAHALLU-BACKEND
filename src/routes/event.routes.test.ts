import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Event } from '../models/Event';

const app = createApp();

describe('GET /api/v1/events', () => {
  it('lists events for the tenant with cleaned descriptions, newest first', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Event.create({
      tenantId: tenant._id,
      title: 'Old Event',
      date: new Date('2026-01-01'),
      description: '**{{EVENT_TITLE}}**',
    });
    await Event.create({
      tenantId: tenant._id,
      title: 'New Event',
      date: new Date('2026-06-01'),
      description: 'Plain text',
    });

    const res = await request(app).get('/api/v1/events').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe('New Event');
    expect(res.body.data[1].description).toBe('Old Event');
  });
});

describe('GET /api/v1/events/:id', () => {
  it('returns 404 when the event does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get(`/api/v1/events/${objectId()}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns the event with a cleaned description', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const ev = await Event.create({
      tenantId: tenant._id,
      title: 'Uroos',
      date: new Date('2026-06-01'),
      description: '**{{EVENT_TITLE}}** notice',
    });

    const res = await request(app).get(`/api/v1/events/${ev._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.body.data.description).toBe('Uroos notice');
  });
});

describe('POST /api/v1/events', () => {
  it('creates an event with a cleaned description', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Iftar', date: '2026-05-01', description: '**{{EVENT_TITLE}}**' });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('Iftar');
  });

  it('does not touch description when none is provided', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No Description Event', date: '2026-05-01' });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBeUndefined();
  });
});

describe('PUT /api/v1/events/:id', () => {
  it('cleans the description when updating it', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const ev = await Event.create({ tenantId: tenant._id, title: 'X', date: new Date('2026-05-01') });

    const res = await request(app)
      .put(`/api/v1/events/${ev._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: '**{{EVENT_TITLE}}** updated', title: 'Renamed Event' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Renamed Event updated');
  });
});

describe('POST /api/v1/events/:id/register', () => {
  it('pushes a registration with registeredAt and attended: false', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const ev = await Event.create({ tenantId: tenant._id, title: 'X', date: new Date('2026-05-01') });
    const memberId = objectId();

    const res = await request(app)
      .post(`/api/v1/events/${ev._id}/register`)
      .set('Authorization', `Bearer ${token}`)
      .send({ memberId: memberId.toString() });

    expect(res.status).toBe(200);
    const updated = await Event.findById(ev._id);
    expect(updated!.registrations).toHaveLength(1);
    expect(updated!.registrations[0].attended).toBe(false);
    expect(updated!.registrations[0].registeredAt).toBeDefined();
  });
});

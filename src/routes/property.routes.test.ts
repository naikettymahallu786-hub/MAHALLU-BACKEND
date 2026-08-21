import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Property } from '../models/Property';
import { RentalRequest } from '../models/RentalRequest';
import { Lease } from '../models/Lease';

const app = createApp();

async function createProperty(tenantId: any, overrides: Partial<Record<string, unknown>> = {}) {
  return Property.create({
    tenantId,
    propertyCode: `PROP-${Math.floor(Math.random() * 1e6)}`,
    type: 'equipment',
    name: 'Chairs',
    ...overrides,
  });
}

describe('GET /api/v1/properties', () => {
  it('lists properties for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await createProperty(tenant._id);

    const res = await request(app).get('/api/v1/properties').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /api/v1/properties', () => {
  it('creates a property with a generated propertyCode', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'building', name: 'Main Building' });

    expect(res.status).toBe(201);
    expect(res.body.data.propertyCode).toMatch(/^PROP-\d{4}$/);
  });

  it('defaults availableQuantity to quantity for equipment', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'equipment', name: 'Chairs', quantity: 50 });

    expect(res.body.data.availableQuantity).toBe(50);
  });
});

describe('POST /api/v1/properties/:id/leases', () => {
  it('creates a lease and marks the property occupied', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const property = await createProperty(tenant._id, { type: 'building' });

    const res = await request(app)
      .post(`/api/v1/properties/${property._id}/leases`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantMemberId: objectId().toString(),
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        rentAmount: 5000,
      });

    expect(res.status).toBe(201);
    const updated = await Property.findById(property._id);
    expect(updated!.status).toBe('occupied');
    expect(updated!.currentLeaseId!.toString()).toBe(res.body.data._id);
  });
});

describe('GET /api/v1/properties/:id/leases', () => {
  it('lists leases for a property', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const property = await createProperty(tenant._id, { type: 'building' });
    await Lease.create({
      tenantId: tenant._id,
      propertyId: property._id,
      tenantMemberId: objectId(),
      startDate: new Date(),
      endDate: new Date(),
      rentAmount: 100,
    });

    const res = await request(app)
      .get(`/api/v1/properties/${property._id}/leases`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/properties/requests', () => {
  it('lists rental requests for the tenant, not colliding with /:id routing', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const property = await createProperty(tenant._id);
    await RentalRequest.create({
      tenantId: tenant._id,
      propertyId: property._id,
      requestedBy: objectId(),
      quantityRequested: 2,
      purpose: 'Event',
    });

    const res = await request(app).get('/api/v1/properties/requests').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/properties/requests/:id', () => {
  it('returns 404 when the request does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .get(`/api/v1/properties/requests/${objectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/properties/requests/:id/approve', () => {
  it('decrements availableQuantity for an equipment property and marks the request approved', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const property = await createProperty(tenant._id, { type: 'equipment', quantity: 10, availableQuantity: 10 });
    const req = await RentalRequest.create({
      tenantId: tenant._id,
      propertyId: property._id,
      requestedBy: objectId(),
      quantityRequested: 3,
      purpose: 'Event',
    });

    const res = await request(app)
      .post(`/api/v1/properties/requests/${req._id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    const updatedProperty = await Property.findById(property._id);
    expect(updatedProperty!.availableQuantity).toBe(7);
  });

  it('rejects with 400 when not enough quantity is available', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const property = await createProperty(tenant._id, { type: 'equipment', quantity: 2, availableQuantity: 2 });
    const req = await RentalRequest.create({
      tenantId: tenant._id,
      propertyId: property._id,
      requestedBy: objectId(),
      quantityRequested: 5,
      purpose: 'Event',
    });

    const res = await request(app)
      .post(`/api/v1/properties/requests/${req._id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('rejects with 400 when the request is already processed', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const property = await createProperty(tenant._id);
    const req = await RentalRequest.create({
      tenantId: tenant._id,
      propertyId: property._id,
      requestedBy: objectId(),
      quantityRequested: 1,
      purpose: 'Event',
      status: 'APPROVED',
    });

    const res = await request(app)
      .post(`/api/v1/properties/requests/${req._id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/properties/requests/:id/reject', () => {
  it('marks the request rejected', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const property = await createProperty(tenant._id);
    const req = await RentalRequest.create({
      tenantId: tenant._id,
      propertyId: property._id,
      requestedBy: objectId(),
      quantityRequested: 1,
      purpose: 'Event',
    });

    const res = await request(app)
      .post(`/api/v1/properties/requests/${req._id}/reject`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const updated = await RentalRequest.findById(req._id);
    expect(updated!.status).toBe('REJECTED');
  });
});

describe('GET /api/v1/properties/:id', () => {
  it('returns 404 when the property does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .get(`/api/v1/properties/${objectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/properties/:id', () => {
  it('recomputes availableQuantity from the delta when quantity changes for equipment', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const property = await createProperty(tenant._id, { type: 'equipment', quantity: 10, availableQuantity: 6 });

    const res = await request(app)
      .put(`/api/v1/properties/${property._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'equipment', quantity: 15 });

    expect(res.status).toBe(200);
    // delta = 15 - 10 = 5; availableQuantity = 6 + 5 = 11
    expect(res.body.data.availableQuantity).toBe(11);
  });

  it('returns 404 when the property does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .put(`/api/v1/properties/${objectId()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

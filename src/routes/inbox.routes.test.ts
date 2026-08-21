import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { RegistrationRequest, RegistrationType, RegistrationStatus } from '../models/RegistrationRequest';
import { CertificateRequest } from '../models/CertificateRequest';
import { RentalRequest } from '../models/RentalRequest';

const app = createApp();

describe('GET /api/v1/inbox', () => {
  it('defaults to PENDING and merges registrations/certificate requests/rental requests, newest first', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.MEMBER,
      status: RegistrationStatus.PENDING,
      payload: { name: 'Alice', phone: '123' },
      createdAt: new Date('2026-01-01'),
    });
    await CertificateRequest.create({
      tenantId: tenant._id,
      requestedBy: objectId(),
      type: 'residence',
      purpose: 'Bank',
      status: 'PENDING',
      createdAt: new Date('2026-03-01'),
    });
    await RentalRequest.create({
      tenantId: tenant._id,
      propertyId: objectId(),
      requestedBy: objectId(),
      quantityRequested: 1,
      purpose: 'Event',
      status: 'PENDING',
      createdAt: new Date('2026-02-01'),
    });

    const res = await request(app).get('/api/v1/inbox').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.map((i: any) => i.type)).toEqual([
      'CERTIFICATE_REQUEST',
      'RENTAL_REQUEST',
      'REGISTRATION',
    ]);
  });

  it('excludes non-matching statuses when a specific status filter is given', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.MEMBER,
      status: RegistrationStatus.APPROVED,
      payload: { name: 'Bob' },
    });
    await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.MEMBER,
      status: RegistrationStatus.PENDING,
      payload: { name: 'Carol' },
    });

    const res = await request(app)
      .get('/api/v1/inbox?status=APPROVED')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('APPROVED');
  });

  it('includes all statuses when status=ALL', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.MEMBER,
      status: RegistrationStatus.APPROVED,
      payload: {},
    });
    await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.MEMBER,
      status: RegistrationStatus.REJECTED,
      payload: {},
    });

    const res = await request(app).get('/api/v1/inbox?status=ALL').set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(2);
  });

  it('formats each item type with the expected title/description/actionUrl shape', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await RegistrationRequest.create({
      tenantId: tenant._id,
      type: RegistrationType.STUDENT,
      status: RegistrationStatus.PENDING,
      payload: { name: 'Dawood', phone: '999' },
    });

    const res = await request(app).get('/api/v1/inbox').set('Authorization', `Bearer ${token}`);

    expect(res.body.data[0]).toMatchObject({
      type: 'REGISTRATION',
      title: 'New student registration request',
      description: 'Name: Dawood\nPhone: 999',
      actionUrl: '/registrations',
    });
  });
});

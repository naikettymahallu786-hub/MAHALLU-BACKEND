import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Certificate } from '../models/Certificate';
import { CertificateRequest } from '../models/CertificateRequest';

const app = createApp();

describe('GET /api/v1/certificates', () => {
  it('lists issued certificates for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Certificate.create({
      tenantId: tenant._id,
      certificateNo: 'CERT-1',
      type: 'residence',
      recipientId: objectId(),
      issuedBy: objectId(),
    });

    const res = await request(app).get('/api/v1/certificates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/certificates/requests', () => {
  it('lists requests, optionally filtered by status, without colliding with /:id routing', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await CertificateRequest.create({
      tenantId: tenant._id,
      requestedBy: objectId(),
      type: 'residence',
      purpose: 'Bank',
      status: 'PENDING',
    });
    await CertificateRequest.create({
      tenantId: tenant._id,
      requestedBy: objectId(),
      type: 'residence',
      purpose: 'Visa',
      status: 'APPROVED',
    });

    const all = await request(app).get('/api/v1/certificates/requests').set('Authorization', `Bearer ${token}`);
    expect(all.body.data).toHaveLength(2);

    const pending = await request(app)
      .get('/api/v1/certificates/requests?status=PENDING')
      .set('Authorization', `Bearer ${token}`);
    expect(pending.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/certificates/requests/:id', () => {
  it('returns 404 when the request does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .get(`/api/v1/certificates/requests/${objectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/certificates/requests/:id/approve', () => {
  it('generates a certificate with a generated certificateNo, merging request details with overrides', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const req = await CertificateRequest.create({
      tenantId: tenant._id,
      requestedBy: objectId(),
      type: 'residence',
      purpose: 'Bank loan',
      details: { note: 'original' },
    });

    const res = await request(app)
      .post(`/api/v1/certificates/requests/${req._id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ details: { extra: 'added' } });

    expect(res.status).toBe(200);
    expect(res.body.data.certificateNo).toMatch(/^CERT-\d{4}-\d{5}$/);
    expect(res.body.data.data).toMatchObject({ note: 'original', extra: 'added', purpose: 'Bank loan' });

    const updatedReq = await CertificateRequest.findById(req._id);
    expect(updatedReq!.status).toBe('APPROVED');
    expect(updatedReq!.certificateId).toBeDefined();
  });

  it('uses customCertificateNo when provided instead of generating one', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const req = await CertificateRequest.create({
      tenantId: tenant._id,
      requestedBy: objectId(),
      type: 'residence',
      purpose: 'X',
    });

    const res = await request(app)
      .post(`/api/v1/certificates/requests/${req._id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ customCertificateNo: 'CUSTOM-001' });

    expect(res.body.data.certificateNo).toBe('CUSTOM-001');
  });

  it('returns 404 when the request does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post(`/api/v1/certificates/requests/${objectId()}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/certificates/requests/:id/reject', () => {
  it('marks the request rejected and stores notes when provided', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const req = await CertificateRequest.create({
      tenantId: tenant._id,
      requestedBy: objectId(),
      type: 'residence',
      purpose: 'X',
    });

    const res = await request(app)
      .post(`/api/v1/certificates/requests/${req._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Missing documents' });

    expect(res.status).toBe(200);
    const updated = await CertificateRequest.findById(req._id);
    expect(updated!.status).toBe('REJECTED');
    expect(updated!.notes).toBe('Missing documents');
  });
});

describe('GET /api/v1/certificates/:id', () => {
  it('returns 404 when the certificate does not exist', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .get(`/api/v1/certificates/${objectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

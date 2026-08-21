import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser } from '../__tests__/helpers';
import { Transaction } from '../models/Transaction';

const app = createApp();

describe('GET /api/v1/finance/transactions', () => {
  it('lists all transactions for the tenant, newest first', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Transaction.create({
      tenantId: tenant._id,
      type: 'INCOME',
      amount: 100,
      category: 'Donation',
      date: new Date('2026-01-01'),
      description: 'Old',
    });
    await Transaction.create({
      tenantId: tenant._id,
      type: 'EXPENSE',
      amount: 50,
      category: 'Maintenance',
      date: new Date('2026-06-01'),
      description: 'New',
    });

    const res = await request(app).get('/api/v1/finance/transactions').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].description).toBe('New');
  });

  it('filters by year when provided', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Transaction.create({
      tenantId: tenant._id,
      type: 'INCOME',
      amount: 100,
      category: 'Donation',
      date: new Date('2025-06-01'),
      description: 'Last year',
    });
    await Transaction.create({
      tenantId: tenant._id,
      type: 'INCOME',
      amount: 100,
      category: 'Donation',
      date: new Date('2026-06-01'),
      description: 'This year',
    });

    const res = await request(app)
      .get('/api/v1/finance/transactions?year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].description).toBe('This year');
  });
});

describe('POST /api/v1/finance/transactions', () => {
  it('creates a transaction scoped to the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/finance/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INCOME', amount: 500, category: 'Donation', date: '2026-05-01', description: 'Test' });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant._id.toString());
  });

  it('rejects when a required field is missing', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/finance/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INCOME', amount: 500 });

    expect(res.status).toBe(400);
  });
});

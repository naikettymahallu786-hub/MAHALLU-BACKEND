import request from 'supertest';
import axios from 'axios';
import { createApp } from '../app';
import { createTenant, createAuthedUser } from '../__tests__/helpers';
import { Mosque } from '../models/Mosque';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const app = createApp();

describe('GET /api/v1/mosque', () => {
  it('returns the tenant\'s mosque (or null if none exists)', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).get('/api/v1/mosque').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('POST /api/v1/mosque', () => {
  it('upserts the tenant\'s mosque', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/mosque')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jamia Masjid' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Jamia Masjid');
    const count = await Mosque.countDocuments({ tenantId: tenant._id });
    expect(count).toBe(1);
  });
});

describe('GET /api/v1/mosque/prayer-times', () => {
  it('fetches timings from the Aladhan API using default coordinates', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { timings: { Fajr: '05:00' } } } });

    const res = await request(app).get('/api/v1/mosque/prayer-times').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ Fajr: '05:00' });
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('latitude=11.0168&longitude=76.9558&method=1'));
  });

  it('uses lat/lng/method query params when provided', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    mockedAxios.get.mockResolvedValueOnce({ data: { data: { timings: {} } } });

    await request(app)
      .get('/api/v1/mosque/prayer-times?lat=10&lng=76&method=2')
      .set('Authorization', `Bearer ${token}`);

    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('latitude=10&longitude=76&method=2'));
  });
});

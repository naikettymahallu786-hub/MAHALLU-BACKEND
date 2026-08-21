import request from 'supertest';
import { createApp } from '../app';

describe('GET /health', () => {
  it('reports the API as running', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Mahallu ERP API is running',
    });
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
  });
});

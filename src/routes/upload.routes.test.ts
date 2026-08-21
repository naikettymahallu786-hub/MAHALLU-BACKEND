import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser } from '../__tests__/helpers';

const app = createApp();

describe('POST /api/v1/upload', () => {
  it('returns the non-functional stub message (no actual upload is implemented)', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).post('/api/v1/upload').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Upload endpoint - use multipart/form-data with multer middleware',
    });
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/upload');
    expect(res.status).toBe(401);
  });
});

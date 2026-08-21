import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser, objectId } from '../__tests__/helpers';
import { Survey } from '../models/Survey';

const app = createApp();

describe('GET /api/v1/surveys', () => {
  it('lists surveys for the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    await Survey.create({ tenantId: tenant._id, title: 'Feedback' });

    const res = await request(app).get('/api/v1/surveys').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /api/v1/surveys', () => {
  it('creates a survey scoped to the tenant', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app)
      .post('/api/v1/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Survey' });

    expect(res.status).toBe(201);
    expect(res.body.data.tenantId).toBe(tenant._id.toString());
  });
});

describe('POST /api/v1/surveys/:id/respond', () => {
  it('pushes a response with a respondedAt timestamp', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);
    const survey = await Survey.create({ tenantId: tenant._id, title: 'Feedback' });

    const res = await request(app)
      .post(`/api/v1/surveys/${survey._id}/respond`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: objectId().toString(), answer: 'yes' }] });

    expect(res.status).toBe(200);
    const updated = await Survey.findById(survey._id);
    expect(updated!.responses).toHaveLength(1);
    expect(updated!.responses[0].respondedAt).toBeDefined();
  });
});

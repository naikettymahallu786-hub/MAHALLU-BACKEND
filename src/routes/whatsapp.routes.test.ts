import request from 'supertest';
import { createApp } from '../app';
import { createTenant, createAuthedUser } from '../__tests__/helpers';
import { WhatsappService } from '../services/whatsapp.service';

const app = createApp();
const ORIGINAL_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

afterEach(() => {
  process.env.WHATSAPP_VERIFY_TOKEN = ORIGINAL_TOKEN;
});

describe('WhatsappService.verifyWebhook (pure logic, isolated from HTTP/middleware)', () => {
  it('matches when mode is subscribe and the token equals WHATSAPP_VERIFY_TOKEN', () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'secret-token';
    expect(WhatsappService.verifyWebhook('subscribe', 'secret-token')).toBe(true);
  });

  it('does not match when the token is wrong', () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'secret-token';
    expect(WhatsappService.verifyWebhook('subscribe', 'wrong-token')).toBe(false);
  });

  it('does not match when mode is not "subscribe"', () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'secret-token';
    expect(WhatsappService.verifyWebhook('unsubscribe', 'secret-token')).toBe(false);
  });
});

describe('GET /api/v1/whatsapp/webhook', () => {
  // KNOWN PRE-EXISTING BUG (confirmed present on main, unrelated to this
  // migration — app.ts's global mongoSanitize() middleware, untouched
  // here, strips any query key containing a "." before any route handler
  // sees it). Meta's webhook verification protocol requires the exact
  // param names hub.mode / hub.verify_token / hub.challenge, so req.query
  // arrives empty and this handler always falls through to 403 — even
  // with the correct token. User has chosen to leave this as-is for now;
  // this test documents the actual current behavior, not the intended one.
  it('returns 403 even with a valid mode/token, because mongoSanitize strips the dotted query keys first', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'secret-token';

    const res = await request(app).get('/api/v1/whatsapp/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'secret-token',
      'hub.challenge': 'challenge-123',
    });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false });
  });

  it('returns 403 when the token does not match', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'secret-token';

    const res = await request(app).get('/api/v1/whatsapp/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-123',
    });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false });
  });
});

describe('POST /api/v1/whatsapp/webhook', () => {
  it('acknowledges with 200 OK regardless of payload (no auth required)', async () => {
    const res = await request(app)
      .post('/api/v1/whatsapp/webhook')
      .send({ entry: [{ id: '1' }] });

    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });
});

describe('POST /api/v1/whatsapp/send', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/whatsapp/send');
    expect(res.status).toBe(401);
  });

  it('returns the stub "queued" response when authenticated', async () => {
    const tenant = await createTenant();
    const { token } = await createAuthedUser(tenant._id);

    const res = await request(app).post('/api/v1/whatsapp/send').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'WhatsApp message queued' });
  });
});

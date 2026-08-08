import { Router, Request, Response } from 'express';
import { getConfig } from '../config';
import { verifySignature, parseWebhookPayload } from '../services/webhook';
import { handleIncomingMessage } from '../services/conversations';

const router = Router();

// Extend Request type to include rawBody buffer captured by express
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * GET /webhook/facebook
 * Meta Webhook verification handshake.
 */
router.get('/facebook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const config = getConfig();

  console.log('[Webhook] Received GET verification handshake:', { mode, token, expected: config.VERIFY_TOKEN });

  if (mode && token) {
    if (mode === 'subscribe' && (token === config.VERIFY_TOKEN || String(token).trim() === config.VERIFY_TOKEN.trim())) {
      console.log('[Webhook] Verification handshake SUCCESSFUL! Sending challenge to Meta.');
      return res.status(200).type('text/plain').send(challenge);
    } else {
      console.error(`[Webhook][403] reason=VerifyTokenMismatch`);
      console.error(`[Webhook][403] path=/webhook/facebook`);
      console.error(`[Webhook][403] hasSignature=false`);
      console.error(`[Webhook][403] hasVerifyToken=${!!config.VERIFY_TOKEN}`);
      console.error(`[Webhook][403] environment=${config.NODE_ENV}`);
      console.error(`[Webhook][403] timestamp=${new Date().toISOString()}`);
      
      console.warn('[Webhook] Verification token mismatch:', { received: token, expected: config.VERIFY_TOKEN });
      return res.status(403).json({ error: 'Forbidden: Verify token mismatch' });
    }
  }

  return res.status(400).json({ error: 'Bad Request: Missing hub.mode or hub.verify_token' });
});

/**
 * POST /webhook/facebook
 * Ingest incoming events from Meta Messenger Platform.
 */
router.post('/facebook', async (req: RequestWithRawBody, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const config = getConfig();

  console.log(`[Realtime][Webhook] RECEIVED`);

  if (!req.rawBody) {
    console.error('[Webhook] Missing req.rawBody. Ensure express.json() is capturing it.');
    return res.status(400).json({ error: 'Bad Request: Missing raw body' });
  }
  const rawBody = req.rawBody;
  const isValid = verifySignature(rawBody, signature, config.APP_SECRET);

  console.log('[Webhook][Signature]');
  console.log('received=true');
  console.log(`hasSignature256=${!!signature}`);
  console.log(`hasAppSecret=${!!config.APP_SECRET}`);
  console.log(`bodyLength=${rawBody.length}`);
  console.log(`verificationResult=${isValid ? 'VALID' : 'INVALID'}`);

  if (!isValid) {
    if (config.NODE_ENV === 'development') {
      console.warn('[Webhook] Warning: X-Hub-Signature-256 signature verification did not match or APP_SECRET is missing. Ingesting event in dev mode...');
    } else {
      console.log('[Webhook][Signature] result=INVALID');
      console.log(`[Webhook][Signature] bodyLength=${rawBody.length}`);
      console.log(`[Webhook][Signature] hasSignature256=${!!signature}`);
      console.log(`[Webhook][Signature] hasAppSecret=${!!config.APP_SECRET}`);
      
      console.warn('[Webhook] Unauthorized: Invalid X-Hub-Signature-256 signature.');
      return res.status(403).json({ error: 'Forbidden: Invalid signature' });
    }
  } else {
    console.log('[Webhook][Signature] result=VALID');
    console.log('[Realtime][Webhook] VERIFIED');
    console.log('[Webhook] X-Hub-Signature-256 verified successfully.');
  }

  // 2. Parse payload
  const events = parseWebhookPayload(req.body);
  console.log(`[Realtime][Webhook] EVENT_RECEIVED count=${events.length}`);
  if (process.env.DEBUG === 'true') console.time(`[Trace] Webhook processing ${events.length} events`);
  console.log(`[Webhook] Processing ${events.length} incoming events from Meta...`);

  // Always return 200 OK to Meta quickly to avoid retry storms
  res.status(200).send('EVENT_RECEIVED');

  // 3. Process events asynchronously
  setImmediate(async () => {
    for (const event of events) {
      const traceId = event.fbMessageId || `trace.${Date.now()}`;
      try {
        console.log(`\n[Realtime][Trace] traceId=${traceId} stage=webhook_received`);
        console.log(`[Realtime][Trace] traceId=${traceId} stage=signature_verified`);
        console.log(`[Webhook] Ingesting message from user ${event.userPsid}: "${event.text}"`);
        
        await handleIncomingMessage({
          senderPsid: event.userPsid,
          recipientPageId: event.pageId,
          messageText: event.text,
          attachments: event.attachments,
          timestamp: event.timestamp,
          fbMessageId: event.fbMessageId,
          isEcho: event.isEcho,
        });
      } catch (err) {
        console.error('[Webhook] Failed to ingest event:', err);
      }
    }
    
    if (process.env.DEBUG === 'true') console.timeEnd(`[Trace] Webhook processing ${events.length} events`);
  });
});

export default router;

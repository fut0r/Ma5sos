import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { config } from './config.js';
import { auth } from './auth.js';
import { MESSAGES } from './messages.js';
import { orders, paylinkWebhook } from './orders.js';
import { mockPaylink } from './paylink.js';
import { loadUser, sameSiteOnly } from './security.js';
import { eventsRouter, publicRouter, statsRouter } from './events.js';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  next();
});

const api = express.Router();
api.use(express.json({ limit: '20kb' }));
api.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

api.use('/paylink/webhook', paylinkWebhook);
if (config.paylink.mode === 'mock') api.use('/mock-paylink', mockPaylink);

api.use(sameSiteOnly, loadUser);
api.get('/health', (req, res) => res.json({ ok: true, status: 'ok', service: 'Ma5sos API', paylink: config.paylink.mode }));
api.use('/auth', auth);
api.use('/orders', orders);
api.use('/events', eventsRouter);
api.use('/stats', statsRouter);
api.use('/public', publicRouter);
api.use((req, res) => res.status(404).json({ error: 'not_found', message: MESSAGES.notFound }));

// eslint-disable-next-line no-unused-vars
api.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_request', message: MESSAGES.badRequest });
  }
  console.error(error);
  res.status(500).json({ error: 'server', message: MESSAGES.server });
});

app.use('/api', api);

const dist = join(config.root, 'dist');
if (existsSync(dist)) {
  app.use(
    express.static(dist, {
      extensions: ['html'],
      setHeaders: (res, path) =>
        res.set('Cache-Control', /[\\/]assets[\\/]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache'),
    }),
  );
  app.use((req, res) => res.status(404).sendFile(join(dist, 'index.html')));
}

app.listen(config.port, () => {
  console.log(`Ma5sos server on http://localhost:${config.port} (Paylink: ${config.paylink.mode})`);
});

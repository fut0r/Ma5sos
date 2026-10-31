import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Settings come from the environment. For local work and for the server's own
 * secrets they are read from .env.local (never committed; see .env.example).
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const localEnv = join(root, '.env.local');
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

const env = (name, fallback = '') => (process.env[name] ?? fallback).trim();

const PAYLINK_TEST = {
  baseUrl: 'https://restpilot.paylink.sa',
  apiId: 'APP_ID_1123453311',
  secretKey: '0662abb5-13c7-38ab-cd12-236e58f43766',
};
const PAYLINK_LIVE_URL = 'https://restapi.paylink.sa';

const production = env('NODE_ENV') === 'production';

const paylinkMode = env('PAYLINK_ENV', production ? '' : 'mock');
if (!['mock', 'test', 'production'].includes(paylinkMode)) {
  throw new Error(`PAYLINK_ENV must be "mock", "test" or "production", not "${paylinkMode}".`);
}
if (production && paylinkMode === 'mock') {
  throw new Error('PAYLINK_ENV=mock is for local work only; set "test" or "production".');
}

const live = paylinkMode === 'production';
const apiId = env('PAYLINK_API_ID') || (live ? '' : PAYLINK_TEST.apiId);
const secretKey = env('PAYLINK_SECRET_KEY') || (live ? '' : PAYLINK_TEST.secretKey);
if (live && (!apiId || !secretKey)) {
  throw new Error('PAYLINK_ENV is "production" but PAYLINK_API_ID or PAYLINK_SECRET_KEY is empty.');
}

const siteUrl = env('SITE_URL', production ? 'https://www.ma5sos.com' : 'http://localhost:5173').replace(/\/+$/, '');
if (production && !siteUrl.startsWith('https://')) {
  throw new Error("In production SITE_URL must be the site's https:// address.");
}

const dbFile = env('DB_FILE') || join(root, 'server', 'data', 'ma5sos.db');
mkdirSync(dirname(dbFile), { recursive: true });

export const config = {
  root,
  production,
  port: Number(env('API_PORT') || env('PORT', '8787')),
  siteUrl,
  dbFile,
  paylink: {
    mode: paylinkMode,
    baseUrl: live ? PAYLINK_LIVE_URL : PAYLINK_TEST.baseUrl,
    apiId,
    secretKey,
    webhookToken: env('PAYLINK_WEBHOOK_TOKEN'),
  },
};

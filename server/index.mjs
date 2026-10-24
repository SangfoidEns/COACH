/**
 * Lightweight API for METALIST STUTTGART Mini App.
 * Endpoints:
 *   GET  /health
 *   POST /api/telegram/validate  { initData: string }
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN  (required for validate)
 *   PORT                (default 8787)
 *   CORS_ORIGIN         (default * — restrict in production)
 *   INITDATA_MAX_AGE_SEC (default 86400)
 */
import http from 'node:http';
import { validateInitData } from './validateInitData.mjs';

const PORT = Number(process.env.PORT || 8787);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_AGE = Number(process.env.INITDATA_MAX_AGE_SEC || 86400);

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, {
        ok: true,
        service: 'metalist-stuttgart-auth',
        hasToken: !!BOT_TOKEN,
        time: new Date().toISOString()
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/telegram/validate') {
      if (!BOT_TOKEN) {
        send(res, 503, { ok: false, error: 'server_misconfigured', message: 'TELEGRAM_BOT_TOKEN not set' });
        return;
      }
      let raw = '';
      try {
        raw = await readBody(req);
      } catch (e) {
        send(res, 413, { ok: false, error: 'body_too_large' });
        return;
      }
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch (_) {
        send(res, 400, { ok: false, error: 'invalid_json' });
        return;
      }
      const initData = payload.initData || payload.init_data || '';
      const result = validateInitData(initData, BOT_TOKEN, { maxAgeSec: MAX_AGE });
      if (!result.ok) {
        send(res, 401, result);
        return;
      }
      // Do not echo secrets; return verified identity only
      send(res, 200, {
        ok: true,
        user: result.user,
        authDate: result.authDate,
        validatedAt: Math.floor(Date.now() / 1000)
      });
      return;
    }

    send(res, 404, { ok: false, error: 'not_found' });
  } catch (e) {
    console.error('[server]', e);
    send(res, 500, { ok: false, error: 'internal' });
  }
});

server.listen(PORT, () => {
  console.info(`[metalist-auth] listening on :${PORT} token=${BOT_TOKEN ? 'set' : 'MISSING'}`);
});

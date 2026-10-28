/**
 * API for METALIST STUTTGART Mini App + Club Bot.
 *
 * Endpoints:
 *   GET  /health
 *   POST /api/telegram/validate     { initData }
 *   GET  /api/bot/status
 *   GET  /api/bot/discover-chats    — знайти chat_id груп з updates
 *   POST /api/bot/attendance-poll   { chatId?, training, hoursBefore? }
 *   POST /api/bot/training-plan     { chatId?, training, clubName? }
 *   POST /api/bot/match-lineup      { chatId?, match, players, clubName? }
 *   POST /api/bot/club-event        { chatId?, title, body, date, place, clubName? }
 *   POST /api/bot/send-text         { chatId?, text }
 *   POST /api/bot/schedule-check    { trainings: [...], chatId?, hoursBefore?: 36 }
 *        — для кожного тренування в вікні ~36h надсилає poll (анти-дубль)
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CLUB_CHAT_ID
 *   BOT_API_SECRET          (optional; if set, require header X-Bot-Secret)
 *   PORT / CORS_ORIGIN / INITDATA_MAX_AGE_SEC
 */
import http from 'node:http';
import { validateInitData } from './validateInitData.mjs';
import * as Bot from './telegramBot.mjs';

const PORT = Number(process.env.PORT || 8787);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_AGE = Number(process.env.INITDATA_MAX_AGE_SEC || 86400);
const BOT_SECRET = process.env.BOT_API_SECRET || '';

/** trainingId -> last poll ISO time (in-memory; restart resets — OK for MVP) */
const pollSent = new Map();

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bot-Secret',
    'Cache-Control': 'no-store'
  });
  res.end(json);
}

function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
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

function parseJson(raw) {
  if (!raw) return {};
  return JSON.parse(raw);
}

function requireBotSecret(req, res) {
  if (!BOT_SECRET) return true;
  const h = req.headers['x-bot-secret'] || '';
  if (h !== BOT_SECRET) {
    send(res, 401, { ok: false, error: 'unauthorized', message: 'X-Bot-Secret required' });
    return false;
  }
  return true;
}

function hoursUntil(dateStr, timeStr) {
  if (!dateStr) return null;
  const t = (timeStr || '12:00').slice(0, 5);
  const d = new Date(dateStr + 'T' + t + ':00');
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bot-Secret',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, {
        ok: true,
        service: 'metalist-stuttgart-api',
        hasToken: Bot.hasToken(),
        defaultChat: Bot.defaultChatId(),
        time: new Date().toISOString()
      });
      return;
    }

    // ── Auth ──────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/api/telegram/validate') {
      if (!BOT_TOKEN) {
        send(res, 503, { ok: false, error: 'server_misconfigured', message: 'TELEGRAM_BOT_TOKEN not set' });
        return;
      }
      let payload = {};
      try {
        payload = parseJson(await readBody(req));
      } catch (e) {
        send(res, e.message === 'body_too_large' ? 413 : 400, { ok: false, error: e.message || 'invalid_json' });
        return;
      }
      const initData = payload.initData || payload.init_data || '';
      const result = validateInitData(initData, BOT_TOKEN, { maxAgeSec: MAX_AGE });
      if (!result.ok) {
        send(res, 401, result);
        return;
      }
      send(res, 200, {
        ok: true,
        user: result.user,
        authDate: result.authDate,
        validatedAt: Math.floor(Date.now() / 1000)
      });
      return;
    }

    // ── Bot status ────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === '/api/bot/status') {
      if (!requireBotSecret(req, res)) return;
      try {
        const me = Bot.hasToken() ? await Bot.getMe() : null;
        send(res, 200, {
          ok: true,
          hasToken: Bot.hasToken(),
          bot: me,
          defaultChat: Bot.defaultChatId(),
          pollsSent: pollSent.size
        });
      } catch (e) {
        send(res, 502, { ok: false, error: e.code || 'tg_error', message: e.message });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/bot/discover-chats') {
      if (!requireBotSecret(req, res)) return;
      try {
        const chats = await Bot.discoverChats();
        send(res, 200, { ok: true, chats });
      } catch (e) {
        send(res, 502, { ok: false, error: e.code || 'tg_error', message: e.message });
      }
      return;
    }

    // ── Bot actions ───────────────────────────────────────
    const botPost = {
      '/api/bot/attendance-poll': async (body) => {
        const result = await Bot.sendAttendancePoll(body);
        if (body.training && body.training.id) {
          pollSent.set(String(body.training.id), new Date().toISOString());
        }
        return { ok: true, result };
      },
      '/api/bot/training-plan': async (body) => ({
        ok: true,
        result: await Bot.sendTrainingPlan(body)
      }),
      '/api/bot/match-lineup': async (body) => ({
        ok: true,
        result: await Bot.sendMatchLineup(body)
      }),
      '/api/bot/club-event': async (body) => ({
        ok: true,
        result: await Bot.sendClubEvent(body)
      }),
      '/api/bot/send-text': async (body) => ({
        ok: true,
        result: await Bot.sendText(body)
      }),
      '/api/bot/schedule-check': async (body) => {
        const hoursBefore = Number(body.hoursBefore != null ? body.hoursBefore : 36);
        const windowHours = Number(body.windowHours != null ? body.windowHours : 6); // вікно 36±3 за замовч. → ±3 через window
        const trainings = Array.isArray(body.trainings) ? body.trainings : [];
        const sent = [];
        const skipped = [];
        for (const t of trainings) {
          if (!t || !t.id || t.status === 'cancelled' || t.status === 'draft') {
            skipped.push({ id: t && t.id, reason: 'invalid' });
            continue;
          }
          const h = hoursUntil(t.date, t.time);
          if (h == null) {
            skipped.push({ id: t.id, reason: 'bad_date' });
            continue;
          }
          // У вікні [hoursBefore - windowHours/2, hoursBefore + windowHours/2]
          const lo = hoursBefore - windowHours / 2;
          const hi = hoursBefore + windowHours / 2;
          if (h < lo || h > hi) {
            skipped.push({ id: t.id, reason: 'out_of_window', hoursUntil: Math.round(h * 10) / 10 });
            continue;
          }
          if (pollSent.has(String(t.id))) {
            skipped.push({ id: t.id, reason: 'already_sent', at: pollSent.get(String(t.id)) });
            continue;
          }
          const result = await Bot.sendAttendancePoll({
            chatId: body.chatId,
            training: t,
            hoursBefore
          });
          pollSent.set(String(t.id), new Date().toISOString());
          sent.push({ id: t.id, result });
        }
        return { ok: true, sent, skipped, hoursBefore };
      }
    };

    if (req.method === 'POST' && botPost[url.pathname]) {
      if (!requireBotSecret(req, res)) return;
      if (!Bot.hasToken()) {
        send(res, 503, { ok: false, error: 'server_misconfigured', message: 'TELEGRAM_BOT_TOKEN not set' });
        return;
      }
      let body = {};
      try {
        body = parseJson(await readBody(req));
      } catch (e) {
        send(res, e.message === 'body_too_large' ? 413 : 400, { ok: false, error: e.message || 'invalid_json' });
        return;
      }
      try {
        const out = await botPost[url.pathname](body);
        send(res, 200, out);
      } catch (e) {
        console.error('[bot]', url.pathname, e.message);
        send(res, 502, { ok: false, error: e.code || 'tg_error', message: e.message, detail: e.payload || null });
      }
      return;
    }

    send(res, 404, { ok: false, error: 'not_found' });
  } catch (e) {
    console.error('[server]', e);
    send(res, 500, { ok: false, error: 'internal' });
  }
});

server.listen(PORT, () => {
  console.info(
    `[metalist-api] :${PORT} token=${Bot.hasToken() ? 'set' : 'MISSING'} chat=${Bot.defaultChatId() || 'none'}`
  );
});

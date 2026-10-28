/**
 * Telegram Bot API helpers for METALIST STUTTGART club chat.
 * Used by server only — token never goes to the browser.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CLUB_CHAT_ID   (optional default group/supergroup id, e.g. -100123...)
 *   BOT_API_SECRET          (optional shared secret for /api/bot/* from Mini App)
 */
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const DEFAULT_CHAT = process.env.TELEGRAM_CLUB_CHAT_ID || '';
const API = () => `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tg(method, body) {
  if (!BOT_TOKEN) {
    const err = new Error('TELEGRAM_BOT_TOKEN not set');
    err.code = 'no_token';
    throw err;
  }
  const res = await fetch(`${API()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error(data.description || 'telegram_api_error');
    err.code = data.error_code || 'tg_error';
    err.payload = data;
    throw err;
  }
  return data.result;
}

function chatId(override) {
  const id = override || DEFAULT_CHAT;
  if (!id) {
    const err = new Error('chat_id required (TELEGRAM_CLUB_CHAT_ID or body.chatId)');
    err.code = 'no_chat';
    throw err;
  }
  return id;
}

/** Опитування відвідування тренування */
export async function sendAttendancePoll({ chatId: cid, training, hoursBefore = 36 } = {}) {
  const t = training || {};
  const title =
    `📋 Відвідування · ${t.name || 'Тренування'}\n` +
    `📅 ${t.date || ''}${t.time ? ' · ' + t.time : ''}\n` +
    `⏱ ${t.duration || '—'} хв` +
    (t.mainGoal ? `\n🎯 ${t.mainGoal}` : '') +
    `\n\nПідтвердіть участь (за ~${hoursBefore} год):`;

  return tg('sendPoll', {
    chat_id: chatId(cid),
    question: title.slice(0, 300),
    options: JSON.stringify(['✅ Буду', '❌ Не зможу', '❓ Пізніше / невпевнений']),
    is_anonymous: false,
    allows_multiple_answers: false
  });
}

/** План тренування текстом */
export async function sendTrainingPlan({ chatId: cid, training, clubName } = {}) {
  const t = training || {};
  const blocks = (t.structure || t.blocks || [])
    .map((b, i) => `${i + 1}. ${b.title || b.name || 'Блок'} — ${b.duration || 0} хв`)
    .join('\n');
  const text =
    `⚽ ${clubName || 'МЕТАЛІСТ ШТУТГАРТ'}\n` +
    `📋 План тренування: ${t.name || 'Тренування'}\n` +
    `📅 ${t.date || ''}${t.time ? ' · ' + t.time : ''}\n` +
    `⏱ ${t.duration || 0} хв · RPE ${t.intensity != null ? t.intensity : '—'}\n` +
    (t.mainGoal ? `🎯 ${t.mainGoal}\n` : '') +
    (blocks ? `\nСтруктура:\n${blocks}` : '') +
    (t.notes ? `\n\n📝 ${t.notes}` : '');

  return tg('sendMessage', {
    chat_id: chatId(cid),
    text: text.slice(0, 4000),
    disable_web_page_preview: true
  });
}

/** Склад / заявка на матч */
export async function sendMatchLineup({ chatId: cid, match, players, clubName } = {}) {
  const m = match || {};
  const list = (players || [])
    .map(p => `• #${p.number || '—'} ${[p.lastName, p.firstName].filter(Boolean).join(' ')} (${p.position || ''})`)
    .join('\n');
  const text =
    `🏟️ ${clubName || 'МЕТАЛІСТ ШТУТГАРТ'}\n` +
    `Склад на матч${m.opponent ? ' vs ' + m.opponent : ''}\n` +
    `📅 ${m.date || ''}${m.time ? ' · ' + m.time : ''}\n` +
    (m.venue ? `📍 ${m.venue}\n` : '') +
    `\n👥 Заявка (${(players || []).length}):\n` +
    (list || '—');

  return tg('sendMessage', {
    chat_id: chatId(cid),
    text: text.slice(0, 4000),
    disable_web_page_preview: true
  });
}

/** Подія клубу */
export async function sendClubEvent({ chatId: cid, title, body, date, place, clubName } = {}) {
  const text =
    `📣 ${clubName || 'МЕТАЛІСТ ШТУТГАРТ'}\n` +
    `«${title || 'Подія клубу'}»\n` +
    (date ? `📅 ${date}\n` : '') +
    (place ? `📍 ${place}\n` : '') +
    (body ? `\n${body}` : '');

  return tg('sendMessage', {
    chat_id: chatId(cid),
    text: text.slice(0, 4000),
    disable_web_page_preview: true
  });
}

/** Довільне повідомлення */
export async function sendText({ chatId: cid, text } = {}) {
  return tg('sendMessage', {
    chat_id: chatId(cid),
    text: String(text || '').slice(0, 4000),
    disable_web_page_preview: true
  });
}

/** getMe — перевірка токена */
export async function getMe() {
  return tg('getMe', {});
}

/**
 * Знайти chat_id групи з останніх updates (бот має бути в групі).
 * Корисно один раз після /start або будь-якого повідомлення в групі.
 */
export async function discoverChats() {
  const updates = await tg('getUpdates', { limit: 50, allowed_updates: JSON.stringify(['message', 'my_chat_member']) });
  const chats = new Map();
  for (const u of updates || []) {
    const c = (u.message && u.message.chat) || (u.my_chat_member && u.my_chat_member.chat);
    if (c && (c.type === 'group' || c.type === 'supergroup')) {
      chats.set(String(c.id), { id: c.id, title: c.title, type: c.type });
    }
  }
  return [...chats.values()];
}

export function hasToken() {
  return !!BOT_TOKEN;
}

export function defaultChatId() {
  return DEFAULT_CHAT || null;
}

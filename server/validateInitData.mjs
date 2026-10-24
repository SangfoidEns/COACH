/**
 * Telegram Mini App initData validation (server-side HMAC).
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
 * hash       = HMAC_SHA256(key=secret_key, message=data_check_string) as hex
 */
import crypto from 'node:crypto';

const DEFAULT_MAX_AGE_SEC = 86400; // 24h

/**
 * @param {string} initData - raw window.Telegram.WebApp.initData
 * @param {string} botToken  - BotFather token (NEVER ship to client)
 * @param {{ maxAgeSec?: number }} [opts]
 * @returns {{ ok: true, user: object|null, authDate: number, queryId?: string } | { ok: false, error: string }}
 */
export function validateInitData(initData, botToken, opts = {}) {
  const maxAgeSec = opts.maxAgeSec != null ? opts.maxAgeSec : DEFAULT_MAX_AGE_SEC;

  if (!initData || typeof initData !== 'string') {
    return { ok: false, error: 'empty_init_data' };
  }
  if (!botToken || typeof botToken !== 'string' || !botToken.includes(':')) {
    return { ok: false, error: 'missing_bot_token' };
  }

  let params;
  try {
    params = new URLSearchParams(initData);
  } catch (_) {
    return { ok: false, error: 'malformed_init_data' };
  }

  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { ok: false, error: 'missing_or_invalid_hash' };
  }

  // data-check-string: all fields except hash, sorted by key, key=value joined by \n
  const pairs = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    pairs.push(key + '=' + value);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculated = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // timing-safe compare
  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'hash_mismatch' };
  }

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || !Number.isFinite(authDate)) {
    return { ok: false, error: 'missing_auth_date' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (maxAgeSec > 0 && (now - authDate > maxAgeSec || authDate > now + 60)) {
    return { ok: false, error: 'auth_date_expired' };
  }

  let user = null;
  const userRaw = params.get('user');
  if (userRaw) {
    try {
      const u = JSON.parse(userRaw);
      if (u && u.id) {
        user = {
          id: u.id,
          username: u.username || '',
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          language_code: u.language_code || '',
          is_premium: !!u.is_premium,
          photo_url: u.photo_url || ''
        };
      }
    } catch (_) {
      return { ok: false, error: 'invalid_user_json' };
    }
  }

  return {
    ok: true,
    user,
    authDate,
    queryId: params.get('query_id') || undefined,
    chatInstance: params.get('chat_instance') || undefined
  };
}

/**
 * Build a valid initData string for unit tests (never use in production clients).
 */
export function buildTestInitData(botToken, user, authDate) {
  const ad = authDate || Math.floor(Date.now() / 1000);
  const pairs = {
    auth_date: String(ad),
    user: JSON.stringify(user)
  };
  const dataCheckString = Object.keys(pairs)
    .sort()
    .map((k) => k + '=' + pairs[k])
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...pairs, hash }).toString();
}

export default validateInitData;

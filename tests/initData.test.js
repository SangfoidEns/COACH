import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateInitData, buildTestInitData } from '../server/validateInitData.mjs';

const TOKEN = '123456:TEST-BOT-TOKEN-FOR-UNIT-TESTS-ONLY';

describe('Telegram initData HMAC validation', () => {
  it('accepts valid signature', () => {
    const initData = buildTestInitData(TOKEN, {
      id: 42,
      username: 'Serdiuk_Artem',
      first_name: 'Artem',
      last_name: 'Serdiuk'
    });
    const res = validateInitData(initData, TOKEN);
    assert.equal(res.ok, true);
    assert.equal(res.user.id, 42);
    assert.equal(res.user.username, 'Serdiuk_Artem');
  });

  it('rejects tampered user payload', () => {
    const initData = buildTestInitData(TOKEN, { id: 1, username: 'coach' });
    const params = new URLSearchParams(initData);
    params.set('user', JSON.stringify({ id: 999, username: 'hacker' }));
    // keep original hash → must fail
    const res = validateInitData(params.toString(), TOKEN);
    assert.equal(res.ok, false);
    assert.equal(res.error, 'hash_mismatch');
  });

  it('rejects wrong bot token', () => {
    const initData = buildTestInitData(TOKEN, { id: 7, username: 'x' });
    const res = validateInitData(initData, '999:WRONG-TOKEN');
    assert.equal(res.ok, false);
    assert.equal(res.error, 'hash_mismatch');
  });

  it('rejects expired auth_date', () => {
    const old = Math.floor(Date.now() / 1000) - 48 * 3600;
    const initData = buildTestInitData(TOKEN, { id: 1, username: 'a' }, old);
    const res = validateInitData(initData, TOKEN, { maxAgeSec: 3600 });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'auth_date_expired');
  });

  it('rejects empty initData', () => {
    const res = validateInitData('', TOKEN);
    assert.equal(res.ok, false);
    assert.equal(res.error, 'empty_init_data');
  });
});

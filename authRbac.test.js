import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function resolveRole(user, rbac) {
  const coaches = (rbac && rbac.coaches) || [];
  const playerLinks = (rbac && rbac.playerLinks) || {};
  if (!user) return { role: 'coach', linkedPlayerId: null };
  const idStr = String(user.id);
  const uname = (user.username || '').toLowerCase();
  const isCoach = coaches.length === 0 || coaches.some(c => {
    const v = String(c).toLowerCase().replace(/^@/, '');
    return v === idStr || v === uname;
  });
  if (isCoach) return { role: 'coach', linkedPlayerId: null };
  const link = playerLinks[idStr] || playerLinks['@' + uname] || playerLinks[uname] || null;
  return { role: 'player', linkedPlayerId: link };
}

describe('RBAC foundation', () => {
  it('no user → coach (local)', () => {
    assert.equal(resolveRole(null, { coaches: ['1'] }).role, 'coach');
  });
  it('empty coaches → all TG users coach', () => {
    assert.equal(resolveRole({ id: 99, username: 'x' }, { coaches: [] }).role, 'coach');
  });
  it('listed coach by id', () => {
    assert.equal(resolveRole({ id: 42 }, { coaches: ['42'] }).role, 'coach');
  });
  it('unlisted → player with link', () => {
    const r = resolveRole({ id: 7, username: 'striker' }, {
      coaches: ['1'],
      playerLinks: { '7': 'p11' }
    });
    assert.equal(r.role, 'player');
    assert.equal(r.linkedPlayerId, 'p11');
  });
});

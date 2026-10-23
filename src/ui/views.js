/** Extracted module: src/ui/views.js lines 1491-1818 — DO NOT rewrite business logic */
const Views = {
  dashboard() {
    try {
      if (typeof AuthManager !== 'undefined') {
        try { AuthManager._resolveRole(); AuthManager._applyUiRole(); } catch (_) {}
        if (AuthManager.isPlayer()) {
          try {
            return this._playerHome();
          } catch (err) {
            console.error('[Views._playerHome]', err);
            return this._playerHomeFallback(err);
          }
        }
        if (AuthManager.isGuest()) {
          try { return this._guestHome(); } catch (e2) {
            console.error('[Views._guestHome]', e2);
          }
        }
        // тренер
        if (AuthManager.isCoach()) return this._coachHome();
      }
    } catch (e) {
      console.error('[Views.dashboard]', e);
    }
    // якщо Auth каже player, ніколи не показуємо тренерську головну
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.isPlayer()) {
        return this._playerHomeFallback();
      }
    } catch (_) {}
    return this._coachHome();
  },

  _playerHomeFallback(err) {
    const msg = err && (err.message || String(err)) ? String(err.message || err) : '';
    let me = null;
    try { me = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer(); } catch (_) {}
    return `
      <div class="st">Команда · МЕТАЛІСТ ШТУТГАРТ</div>
      ${me ? this._fifaCard(me, {}) : this._noPlayerLink()}
      <div class="card glass">
        <div class="ct">Режим гравця</div>
        <p class="note-sm">Картка та порівняння тимчасово обмежені.${msg ? ' (' + sanitize(msg) + ')' : ''}</p>
        <p class="note-sm">Попросіть тренера перевірити Telegram-нік у вашій анкеті та зробіть Імпорт JSON.</p>
        <button type="button" class="btn btn-s btn-sm" data-io="import" data-action="import-trigger">Імпорт JSON</button>
      </div>`;
  },

  _coachHome() {
    const s = Store.get();
    const avail = s.players.filter(p => p.status === 'available' || p.status === 'healthy' || !p.status).length;
    const injured = s.players.filter(p => p.status === 'injured' || p.status === 'recovery' || p.status === 'rehab').length;
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const weekLoad = LoadModel.weeklyLoad(s.trainings);
    const pastForStats = (typeof LoadModel !== 'undefined' && LoadModel.pastTrainings)
      ? LoadModel.pastTrainings(s.trainings) : s.trainings.filter(t => t.date && t.date <= today() && t.status !== 'cancelled');
    const totalHours = Math.round(pastForStats.reduce((a, t) => a + (t.duration || 0), 0) / 60 * 10) / 10;
    const nextMatch = s.matches.filter(m => m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const recent = s.trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    const drafts = s.trainings.filter(t => t.status === 'draft' || t.status === 'pinned');

    const boardCount = (s.boards || []).length;
    return `
      <div class="st">Головна · МЕТАЛІСТ ШТУТГАРТ</div>
      <div class="home-quick-row">
        <button type="button" class="btn btn-p btn-sm" data-action="new-training">+ Тренування</button>
        <button type="button" class="btn btn-s btn-sm" data-view="players">Склад</button>
        <button type="button" class="btn btn-s btn-sm" data-view="analytics">Статистика</button>
        <button type="button" class="btn btn-s btn-sm" data-view="tactics">Схеми</button>
      </div>
      <div class="coach-tools-collapse glass" id="coachToolsCollapse">
        <button type="button" class="coach-tools-handle" data-action="toggle-coach-tools" aria-expanded="false">
          <span>🛠 Інструменти тренера</span>
          <span class="note-sm">утримуйте або натисніть</span>
        </button>
        <div class="coach-tools-body" hidden>
          ${typeof CoachTools !== 'undefined' ? CoachTools.panelHtml() : ''}
        </div>
      </div>
      <div class="dg">
        <div class="sc sc-tap" data-view="players" role="button" title="Відкрити склад">
          <div class="lb">Доступні гравці</div><div class="vl">${avail}</div><div class="sb">з ${s.players.length} · відкрити</div>
        </div>
        <div class="sc"><div class="lb">Травмовані / відновлення</div><div class="vl" style="color:var(--danger)">${injured}</div></div>
        <div class="sc sc-tap sc-next-training${next ? '' : ' is-empty'}" ${next ? `data-next-training="${next.id}"` : ''} role="button" title="Утримуйте для плану">
          <div class="lb">Наступне тренування</div>
          <div class="vl" style="font-size:14px">${next ? sanitize(next.name) : '—'}</div>
          <div class="sb">${next ? next.date + ' ' + (next.time || '') + ' · утримуйте' : ''}</div>
        </div>
        <div class="sc"><div class="lb">Тривалість</div><div class="vl">${next ? next.duration : 0}<span style="font-size:13px"> хв</span></div></div>
        <div class="sc"><div class="lb">Тижневе навантаження</div><div class="vl">${weekLoad}</div><div class="sb">Duration × RPE</div></div>
        <div class="sc"><div class="lb">Години тренувань</div><div class="vl">${totalHours}</div></div>
        <div class="sc"><div class="lb">Наступний матч</div><div class="vl" style="font-size:14px">${nextMatch ? 'vs ' + sanitize(nextMatch.opponent) : '—'}</div><div class="sb">${nextMatch ? nextMatch.date : ''}</div></div>
        <div class="sc"><div class="lb">Тренувань</div><div class="vl">${s.trainings.length}</div></div>
      </div>
      <div class="qa coach-only">
        <button class="btn btn-p" data-action="new-training">+ Нове тренування</button>
        <button class="btn btn-s" data-view="players">👥 Склад</button>
        <button class="btn btn-s" data-view="analytics">📊 Статистика</button>
      </div>
      <div class="card"><div class="ct">Останні тренування</div>
        ${recent.length ? recent.map(t => `<div class="li"><div class="inf"><div class="ti">${sanitize(t.name)}</div><div class="me">${t.date} · ${t.duration}хв · ${t.status}</div></div>
          <button class="btn btn-s btn-sm coach-only" data-edit-training="${t.id}">Відкрити</button></div>`).join('') : '<div class="es">Немає тренувань</div>'}
      </div>
      <div class="card coach-only"><div class="ct">Чернетки / Закріплені</div>
        ${drafts.length ? drafts.map(t => `<div class="li"><div class="inf"><div class="ti">${sanitize(t.name)}</div><div class="me"><span class="badge b-i">${t.status}</span></div></div>
          <button class="btn btn-s btn-sm" data-edit-training="${t.id}">Відкрити</button></div>`).join('') : '<div class="es">Немає чернеток</div>'}
      </div>`;
  },

  /** FIFA + iOS Glass картка гравця */
  _resolvePlayerAvatar(p) {
    if (!p) return '';
    if (p.telegramPhotoUrl) return p.telegramPhotoUrl;
    if (p.photoUrl) return p.photoUrl;
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.getLinkedPlayer) {
        const me = AuthManager.getLinkedPlayer();
        if (me && me.id === p.id && typeof TelegramManager !== 'undefined') {
          const url = TelegramManager.getUserPhotoUrl && TelegramManager.getUserPhotoUrl();
          if (url) return url;
        }
      }
      // якщо нік збігається з поточним TG-користувачем
      if (typeof TelegramManager !== 'undefined' && TelegramManager.getUser) {
        const u = TelegramManager.getUser();
        if (u && u.photo_url && p.telegramUsername) {
          const a = String(p.telegramUsername).replace(/^@/, '').toLowerCase();
          const b = String(u.username || '').replace(/^@/, '').toLowerCase();
          if (a && b && a === b) return u.photo_url;
        }
        if (u && u.photo_url && p.telegramId && String(p.telegramId) === String(u.id)) {
          return u.photo_url;
        }
      }
    } catch (_) {}
    return '';
  },

  _fifaCard(p, stats) {
    if (!p) return '';
    const st = p.status || 'available';
    const stLabel = ({ available: 'Здоровий', healthy: 'Здоровий', injured: 'Травмований', rehab: 'Відновлення', recovery: 'Відновлення' })[st] || st;
    const pos = p.position || '—';
    const ovr = Math.round((Number(p.readiness != null ? p.readiness : p.condition) || 70) * 0.85 + (100 - Math.min(100, (p.load || 0) * 8)) * 0.15);
    const att = stats.attPct != null ? stats.attPct + '%' : '—';
    const rpe = stats.avgRpe != null ? stats.avgRpe : '—';
    const load = stats.load28 != null ? stats.load28 : '—';
    const cond = p.readiness != null ? p.readiness : (p.condition != null ? p.condition : 80);
    const initials = ((p.firstName || '')[0] || '') + ((p.lastName || '')[0] || '');
    const cap = p.isCaptain ? '<span class="fifa-cap">C</span>' : '';
    const tg = p.telegramUsername ? '@' + sanitize(p.telegramUsername) : '';
    const posColor = ({ GK: '#f1c40f', CB: '#3498db', LB: '#3498db', RB: '#3498db', DM: '#2ecc71', CM: '#2ecc71', AM: '#2ecc71', LW: '#e74c3c', RW: '#e74c3c', ST: '#e74c3c' })[pos] || '#c8a84b';
    const photo = this._resolvePlayerAvatar(p);
    const avatarInner = photo
      ? `<img class="fifa-avatar-img" src="${sanitize(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"/><span class="fifa-avatar-fallback" style="display:none">${sanitize(initials.toUpperCase())}</span>`
      : `<span>${sanitize(initials.toUpperCase())}</span>`;

    return `
      <div class="fifa-card glass">
        <div class="fifa-shine"></div>
        <div class="fifa-top">
          <div class="fifa-ovr" style="border-color:${posColor}">
            <span class="fifa-ovr-num">${ovr}</span>
            <span class="fifa-pos" style="color:${posColor}">${sanitize(pos)}</span>
          </div>
          <div class="fifa-avatar" style="background:linear-gradient(145deg,${posColor}55,${posColor}22)">
            ${avatarInner}
            ${cap}
          </div>
          <div class="fifa-club">
            <div class="fifa-club-name">МЕТАЛІСТ</div>
            <div class="fifa-club-sub">Штутгарт</div>
          </div>
        </div>
        <div class="fifa-name">
          <span class="fifa-num">#${p.number || '—'}</span>
          ${sanitize(p.firstName || '')} <strong>${sanitize(p.lastName || '')}</strong>
        </div>
        <div class="fifa-meta">${sanitize(stLabel)}${tg ? ' · ' + tg : ''}</div>
        <div class="fifa-stats">
          <div class="fifa-stat"><b>${cond}%</b><span>Готовність</span></div>
          <div class="fifa-stat"><b>${att}</b><span>Відвідування</span></div>
          <div class="fifa-stat"><b>${rpe}</b><span>Сер. RPE</span></div>
          <div class="fifa-stat"><b>${load}</b><span>Load 28д</span></div>
          <div class="fifa-stat"><b>${p.load != null ? p.load : '—'}</b><span>Load</span></div>
          <div class="fifa-stat"><b>${p.age || '—'}</b><span>Вік</span></div>
        </div>
      </div>`;
  },

  _statBar(label, value, max, color) {
    const v = Math.max(0, Math.min(max, Number(value) || 0));
    const pct = max > 0 ? Math.round((v / max) * 100) : 0;
    return `<div class="stat-bar-row">
      <div class="stat-bar-label">${sanitize(label)}</div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${color || 'var(--club-secondary)'}"></div></div>
      <div class="stat-bar-val">${Number.isFinite(v) ? (Number.isInteger(v) ? v : v.toFixed(1)) : '—'}</div>
    </div>`;
  },

  _compareBlock(me, otherId) {
    const s = Store.get();
    if (!me) return '';
    const others = (s.players || []).filter(p => p.id !== me.id).sort((a, b) => (a.number || 0) - (b.number || 0));
    const opts = others.map(p =>
      `<option value="${p.id}" ${otherId === p.id ? 'selected' : ''}>#${p.number || '—'} ${sanitize(p.lastName || p.firstName || '')}</option>`
    ).join('');
    const other = otherId ? others.find(p => p.id === otherId) : null;
    const a = this._playerStats(me.id);
    const b = other ? this._playerStats(other.id) : null;
    const condA = me.readiness != null ? me.readiness : (me.condition != null ? me.condition : 80);
    const condB = other ? (other.readiness != null ? other.readiness : (other.condition != null ? other.condition : 80)) : 0;

    let charts = '';
    if (other && b) {
      charts = `
        <div class="compare-grid">
          <div class="compare-col">
            <div class="compare-name">Ви · #${me.number || ''}</div>
            ${this._statBar('Готовність %', condA, 100, '#2ecc71')}
            ${this._statBar('Відвідування %', a.attPct || 0, 100, '#3498db')}
            ${this._statBar('Сер. RPE', a.avgRpe || 0, 10, '#f1c40f')}
            ${this._statBar('Load 28д', a.load28 || 0, Math.max(200, (a.load28 || 0) * 1.2, (b.load28 || 0) * 1.2), '#e67e22')}
            ${this._statBar('Load зараз', me.load || 0, 10, '#9b59b6')}
          </div>
          <div class="compare-col">
            <div class="compare-name">#${other.number || ''} ${sanitize(other.lastName || '')}</div>
            ${this._statBar('Готовність %', condB, 100, '#2ecc71')}
            ${this._statBar('Відвідування %', b.attPct || 0, 100, '#3498db')}
            ${this._statBar('Сер. RPE', b.avgRpe || 0, 10, '#f1c40f')}
            ${this._statBar('Load 28д', b.load28 || 0, Math.max(200, (a.load28 || 0) * 1.2, (b.load28 || 0) * 1.2), '#e67e22')}
            ${this._statBar('Load зараз', other.load || 0, 10, '#9b59b6')}
          </div>
        </div>
        <div class="compare-radar card-inner">
          <div class="ct" style="margin-bottom:8px">Порівняльна діаграма</div>
          ${this._compareSvg(me, other, a, b, condA, condB)}
        </div>`;
    } else {
      charts = `<p class="note-sm">Оберіть партнера зі складу, щоб порівняти готовність, відвідування, RPE та навантаження.</p>`;
    }

    return `
      <div class="card glass compare-card">
        <div class="ct">Порівняння зі складом</div>
        <div class="fgr" style="margin:8px 0">
          <label>Порівняти з</label>
          <select id="playerCompareSel" data-action="player-compare">
            <option value="">— оберіть гравця —</option>
            ${opts}
          </select>
        </div>
        ${charts}
      </div>`;
  },

  _compareSvg(me, other, a, b, condA, condB) {
    // простий SVG bar chart 5 метрик
    const metrics = [
      { label: 'Готовн.', va: condA, vb: condB, max: 100 },
      { label: 'Відвід.%', va: a.attPct || 0, vb: b.attPct || 0, max: 100 },
      { label: 'RPE', va: a.avgRpe || 0, vb: b.avgRpe || 0, max: 10 },
      { label: 'Load28', va: a.load28 || 0, vb: b.load28 || 0, max: Math.max(1, a.load28 || 0, b.load28 || 0, 50) },
      { label: 'Load', va: me.load || 0, vb: other.load || 0, max: 10 }
    ];
    const W = 320, H = 140, pad = 28, gap = 12;
    const barW = (W - pad * 2 - gap * (metrics.length - 1)) / metrics.length;
    let bars = '';
    metrics.forEach((m, i) => {
      const x = pad + i * (barW + gap);
      const ha = Math.round((m.va / m.max) * (H - 40));
      const hb = Math.round((m.vb / m.max) * (H - 40));
      const bw = barW / 2 - 2;
      bars += `<rect x="${x}" y="${H - 20 - ha}" width="${bw}" height="${ha}" rx="3" fill="#3498db"/>`;
      bars += `<rect x="${x + bw + 2}" y="${H - 20 - hb}" width="${bw}" height="${hb}" rx="3" fill="#e74c3c"/>`;
      bars += `<text x="${x + barW / 2}" y="${H - 4}" text-anchor="middle" fill="#9aa4b2" font-size="9">${m.label}</text>`;
    });
    return `<svg class="compare-svg" viewBox="0 0 ${W} ${H}" width="100%" height="140" aria-label="Порівняння">
      <text x="8" y="14" fill="#3498db" font-size="10">■ Ви</text>
      <text x="50" y="14" fill="#e74c3c" font-size="10">■ Партнер</text>
      ${bars}
    </svg>`;
  },


  _noPlayerLink() {
    return '<div class="card"><div class="ct">Профіль не прив\u2019язано</div>'
      + '<p class="note-sm">Попросіть тренера вказати ваш Telegram-нік в анкеті гравця.</p></div>';
  },

  _playerStats(playerId) {
    try {
      const s = Store.get();
      const LM = (typeof LoadModel !== 'undefined') ? LoadModel : null;
      return {
        attPct: LM && LM.attendanceRate ? LM.attendanceRate(s.trainings, playerId) : 0,
        avgRpe: LM && LM.avgPlayerRpe ? LM.avgPlayerRpe(s.trainings, playerId) : 0,
        load28: LM && LM.playerLoad ? LM.playerLoad(s.trainings, playerId, 28) : 0
      };
    } catch (e) {
      console.warn('[playerStats]', e);
      return { attPct: 0, avgRpe: 0, load28: 0 };
    }
  },

  _playerHome() {
    const s = Store.get();
    let me = null;
    try { me = AuthManager.getLinkedPlayer(); } catch (_) { me = null; }
    // якщо роль player, але link втрачено — спробувати знайти ще раз
    if (!me && AuthManager.user) {
      try {
        AuthManager._resolveRole();
        me = AuthManager.getLinkedPlayer();
      } catch (_) {}
    }
    const stats = me ? this._playerStats(me.id) : { attPct: 0, avgRpe: 0, load28: 0 };
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nextMatch = s.matches.filter(m => m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const teamAvail = s.players.filter(p => p.status === 'available' || p.status === 'healthy' || !p.status).length;
    const recentAtt = (s.trainings || []).filter(t => t.attendance && me && t.attendance[me.id])
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);

    return `
      <div class="st">Команда · МЕТАЛІСТ ШТУТГАРТ
        <button type="button" class="btn btn-s btn-sm" data-io="import" data-action="import-trigger" title="Оновити дані від тренера">Імпорт JSON</button>
      </div>
      ${me ? this._fifaCard(me, stats) : this._noPlayerLink()}
      ${me ? this._myStatsCharts(me, stats) : ''}
      ${me ? this._compareBlock(me, (typeof window !== 'undefined' && window.__playerCompareId) || '') : ''}
      <div class="dg player-team-stats">
        <div class="sc"><div class="lb">Наступне тренування</div><div class="vl" style="font-size:13px">${next ? sanitize(next.name) : '—'}</div><div class="sb">${next ? next.date + ' ' + (next.time || '') : ''}</div></div>
        <div class="sc"><div class="lb">Наступний матч</div><div class="vl" style="font-size:13px">${nextMatch ? 'vs ' + sanitize(nextMatch.opponent) : '—'}</div><div class="sb">${nextMatch ? nextMatch.date : ''}</div></div>
        <div class="sc"><div class="lb">У строю</div><div class="vl">${teamAvail}</div><div class="sb">з ${s.players.length}</div></div>
      </div>
      <div class="card"><div class="ct">Мої останні відвідування</div>
        ${recentAtt.length ? recentAtt.map(t => {
          const a = t.attendance[me.id];
          const ok = a && a.present;
          return `<div class="li"><div class="inf"><div class="ti">${sanitize(t.name)}</div>
            <div class="me">${t.date} · ${ok ? '✓ був' : '✗ відсутній'}${ok && a.intensity != null ? ' · RPE ' + a.intensity : ''}</div></div>
            <span class="badge ${ok ? 'b-ok' : 'b-d'}">${ok ? 'OK' : '—'}</span></div>`;
        }).join('') : '<div class="es">Ще немає відміток відвідування</div>'}
      </div>
      <div class="card"><div class="ct">Склад команди</div>
        <div class="team-mini-list">${s.players.slice().sort((a,b)=>(a.number||0)-(b.number||0)).map(p => {
          const st = p.status || 'available';
          const bc = (st === 'injured') ? 'inj' : ((st === 'rehab' || st === 'recovery') ? 'reh' : '');
          const meCls = me && p.id === me.id ? ' me' : '';
          return `<div class="team-mini${meCls} ${bc}"><span class="tm-num">#${p.number||''}</span>
            <span class="tm-name">${sanitize(p.lastName||'')} ${sanitize((p.firstName||'')[0]||'')}</span>
            <span class="tm-pos">${sanitize(p.position||'')}</span></div>`;
        }).join('')}</div>
      </div>`;
  },

  _guestHome() {
    const s = Store.get();
    const avail = s.players.filter(p => p.status === 'available' || p.status === 'healthy' || !p.status).length;
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nextMatch = s.matches.filter(m => m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    return `
      <div class="st">МЕТАЛІСТ ШТУТГАРТ
        <button type="button" class="btn btn-s btn-sm" data-io="import" data-action="import-trigger">Імпорт JSON</button>
      </div>
      <div class="card glass guest-hero">
        <div class="guest-title">Офіційний клубний простір</div>
        <p class="note-sm">Ви увійшли як <strong>гість</strong>. Повна статистика доступна гравцям складу та тренеру.</p>
        <button type="button" class="btn btn-p" data-io="import" data-action="import-trigger" style="width:100%;min-height:48px;margin-top:10px">📥 Імпорт JSON від тренера</button>
        <p class="note-sm" style="margin-top:8px">Тренер експортує файл → ви імпортуєте і бачите актуальний склад/розклад.</p>
      </div>
      <div class="dg">
        <div class="sc"><div class="lb">Гравців у складі</div><div class="vl">${s.players.length}</div></div>
        <div class="sc"><div class="lb">У строю</div><div class="vl">${avail}</div></div>
        <div class="sc"><div class="lb">Наступне тренування</div><div class="vl" style="font-size:13px">${next ? sanitize(next.name) : '—'}</div><div class="sb">${next ? next.date : ''}</div></div>
        <div class="sc"><div class="lb">Наступний матч</div><div class="vl" style="font-size:13px">${nextMatch ? 'vs ' + sanitize(nextMatch.opponent) : '—'}</div><div class="sb">${nextMatch ? nextMatch.date : ''}</div></div>
      </div>
      <div class="card"><div class="ct">Склад (скорочено)</div>
        <div class="team-mini-list">${s.players.slice().sort((a,b)=>(a.number||0)-(b.number||0)).map(p =>
          `<div class="team-mini"><span class="tm-num">#${p.number||''}</span>
            <span class="tm-name">${sanitize(p.lastName||'')}</span>
            <span class="tm-pos">${sanitize(p.position||'')}</span></div>`
        ).join('')}</div>
      </div>`;
  },

  trainings() {
    const s = Store.get();
    const list = s.trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `
      <div class="st">Тренування <button class="btn btn-p btn-sm" data-action="new-training">+ Нове</button></div>
      <div class="fb">
        <input type="search" id="trSearch" placeholder="Пошук..." data-filter="trainings">
        <select id="trStatus" data-filter="trainings">
          <option value="">Всі статуси</option>
          <option value="draft">Чернетка</option><option value="planned">Заплановане</option>
          <option value="done">Проведено</option><option value="pinned">Закріплене</option>
          <option value="cancelled">Скасовано</option>
        </select>
      </div>
      <div id="trList">${this._trList(list)}</div>`;
  },

  _trStatusLabel(st) {
    const map = {
      draft: 'Чернетка', planned: 'Заплановане', done: 'Проведено',
      pinned: 'Закріплене', cancelled: 'Скасовано', canceled: 'Скасовано'
    };
    return map[st] || st || '—';
  },

  _trStatusBadge(st) {
    const cls = ({
      draft: 'b-i', planned: 'b-ok', done: 'b-ok',
      pinned: 'b-i', cancelled: 'b-d', canceled: 'b-d'
    })[st] || 'b-i';
    return `<span class="badge ${cls}">${sanitize(this._trStatusLabel(st))}</span>`;
  },

  /**
   * Картки в стилі Telegram: короткий тап = деталі,
   * long-press = меню дій (редагувати, відвідування, дубль, скасувати, видалити).
   */
  _trList(list) {
    if (!list.length) return '<div class="es"><div class="ic">📋</div>Немає тренувань</div>';
    return list.map(t => {
      const total = (t.structure || []).reduce((a, b) => a + (b.duration || 0), 0);
      const structPreview = t.structure && t.structure.length
        ? t.structure.map(b => sanitize(b.title || b.name) + '(' + b.duration + 'хв)').join(' → ') + ' = ' + total + 'хв'
        : '';
      const cancelled = t.status === 'cancelled' || t.status === 'canceled';
      return `<div class="tg-row card-training${cancelled ? ' is-cancelled' : ''}"
          data-training-id="${t.id}"
          data-edit-training="${t.id}"
          role="button" tabindex="0"
          aria-label="${sanitize(t.name)}">
        <div class="tg-row-main">
          <div class="tg-row-title">${sanitize(t.name)}</div>
          <div class="tg-row-sub">${t.date || ''} ${t.time || ''} · ${t.duration || 0}хв · ${this._trStatusBadge(t.status)} · Load ${LoadModel.sessionLoad(t.duration, t.intensity)}</div>
          ${structPreview ? `<div class="tg-row-preview">${structPreview}</div>` : ''}
        </div>
        <div class="tg-row-chevron" aria-hidden="true">›</div>
      </div>`;
    }).join('');
  },

  players() {
    const s = Store.get();
    const sortKey = (s.ui && s.ui.playerSort) || 'role';
    const sortDir = (s.ui && s.ui.playerSortDir) === 'desc' ? -1 : 1;

    const attPct = (pid) => {
      try {
        if (typeof Views._playerStats === 'function') {
          const st = Views._playerStats(pid);
          return st && st.attPct != null ? st.attPct : 0;
        }
      } catch (_) {}
      return 0;
    };
    const isStarter = (p) => {
      if (p.isStarter === true || p.role === 'starter' || p.squadRole === 'starter') return true;
      if (p.isStarter === false || p.role === 'reserve' || p.squadRole === 'reserve' || p.onBench) return false;
      // heuristic: first 11 by number if no flag — prefer available non-injured as starter-ish
      return !(p.status === 'injured' || p.status === 'rehab' || p.status === 'recovery');
    };
    const roleLabel = (p) => isStarter(p) ? 'Основа' : 'Резерв';

    let list = (s.players || []).slice();
    list.sort((a, b) => {
      // primary: starters first
      const ra = isStarter(a) ? 0 : 1;
      const rb = isStarter(b) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      let cmp = 0;
      if (sortKey === 'number') cmp = (a.number || 0) - (b.number || 0);
      else if (sortKey === 'name') cmp = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'uk');
      else if (sortKey === 'pos') cmp = String(a.position || '').localeCompare(String(b.position || ''), 'uk');
      else if (sortKey === 'att') cmp = attPct(a.id) - attPct(b.id);
      else if (sortKey === 'role') cmp = 0;
      else cmp = (a.number || 0) - (b.number || 0);
      return cmp * sortDir || ((a.number || 0) - (b.number || 0));
    });

    const th = (key, label) => {
      const active = sortKey === key ? (sortDir < 0 ? ' ↓' : ' ↑') : '';
      return `<button type="button" class="pl-th${sortKey === key ? ' on' : ''}" data-player-sort="${key}">${label}${active}</button>`;
    };

    const rows = list.map(p => {
      const att = attPct(p.id);
      const role = roleLabel(p);
      const st = p.status || 'available';
      const inj = (st === 'injured' || st === 'rehab' || st === 'recovery');
      return `<div class="pl-row tg-row${inj ? ' is-injured' : ''}${!isStarter(p) ? ' is-reserve' : ''}"
        data-player-id="${p.id}" data-player-row="${p.id}">
        <span class="pl-num">#${p.number || '—'}</span>
        <span class="pl-name">${sanitize(p.lastName || '')} ${sanitize((p.firstName || '')[0] || '')}.</span>
        <span class="pl-pos">${sanitize(p.position || '')}</span>
        <span class="pl-att">${att}%</span>
        <span class="pl-role">${role}</span>
      </div>`;
    }).join('');

    return `
      <div class="st">Склад
        <button class="btn btn-p btn-sm" data-action="new-player">+ Гравець</button>
      </div>
      <p class="note-sm">Основа зверху, резерв знизу. Утримуйте рядок — меню як у Telegram.</p>
      <div class="pl-table glass">
        <div class="pl-head">
          ${th('number', '№')}
          ${th('name', 'Прізвище')}
          ${th('pos', 'Поз.')}
          ${th('att', 'Відв.%')}
          ${th('role', 'Склад')}
        </div>
        <div class="pl-body">${rows || '<div class="es">Немає гравців</div>'}</div>
      </div>`;
  },

  tactics() {
    const s = Store.get();
    return `
      <div class="st">Тактичні схеми</div>
      <div class="card"><div class="ct">Шаблони тренувальних розстановок</div>
        <p class="note-sm">Сучасні шаблони для дошки. Після відкриття можна вільно змінювати позиції, стрілки та зони.</p>
        <div class="sg">${(DEMO.boardTemplates||[]).map(t => `
          <button type="button" class="sb2" data-board-tpl="${t.scheme}" title="${sanitize(t.description)}"
            style="text-align:left;min-width:150px;padding:10px 12px">
            <strong>${sanitize(t.name)}</strong><br>
            <span style="font-size:10px;color:var(--muted)">${t.scheme}</span>
          </button>`).join('')}</div>
      </div>
      <div class="card"><div class="ct">Усі формації</div>
        <div class="sg">${Object.keys(SCHEMES).map(k => `<button class="sb2" data-scheme="${k}">${k}</button>`).join('')}</div>
      </div>
      <div class="card"><div class="ct">Збережені схеми</div>
        <p class="note-sm">Утримуйте схему — відкрити / прикріпити до тренування, гравця чи щоденника.</p>
        ${(() => {
          const boards = (s.boards || []).slice();
          const typeOf = (b) => b.schemeType || b.type || (b.name && /тренув|plan|session/i.test(b.name) ? 'training' : (b.name && /гравець|player/i.test(b.name) ? 'player' : 'tactics'));
          const label = { training: 'План тренування', tactics: 'Тактика', player: 'Для гравців' };
          const groups = { training: [], tactics: [], player: [] };
          boards.forEach(b => {
            const t = typeOf(b);
            (groups[t] || groups.tactics).push(b);
          });
          const order = ['training', 'tactics', 'player'];
          let html = '';
          order.forEach(g => {
            if (!groups[g].length) return;
            html += '<div class="scheme-group-title">' + label[g] + '</div>';
            groups[g].sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
            html += groups[g].map(b => `
              <div class="tg-row scheme-row" data-board-id="${b.id}" role="button" tabindex="0">
                <div class="tg-row-main">
                  <div class="tg-row-title">${sanitize(b.name)}</div>
                  <div class="tg-row-sub">${fmtDate(b.createdAt)} · ${(b.objects||[]).length} об'єктів</div>
                </div>
                <div class="tg-row-chevron">›</div>
              </div>`).join('');
          });
          return html || '<div class="es">Збережіть схему з дошки (💾)</div>';
        })()}
      </div>
      <div class="card"><div class="ct">Спеціальні</div>
        <div class="sg">
          ${['attack','defense','press','setpiece','transition','highpress'].map(t =>
            `<button class="sb2" data-special="${t}">${t}</button>`).join('')}
        </div>
      </div>`;
  },

  calendar() {
    const s = Store.get();
    const mode = s.ui.calView || 'month';
    const d = new Date(s.ui.calDate + 'T12:00:00');
    const year = d.getFullYear(), month = d.getMonth();
    const title = d.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = today();
    let grid = '<div class="cg">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].forEach(n => grid += `<div class="cdn">${n}</div>`);
    for (let i = 0; i < startDay; i++) grid += '<div class="cd om"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const has = s.calendar.some(e => e.date === ds) || s.trainings.some(t => t.date === ds) || s.matches.some(m => m.date === ds);
      grid += `<div class="cd ${ds === todayStr ? 'today' : ''} ${has ? 'has' : ''} ${s.ui.selectedDay === ds ? 'sel' : ''}" data-day="${ds}">${day}</div>`;
    }
    grid += '</div>';

    const ds = s.ui.selectedDay || todayStr;
    const events = [
      ...s.calendar.filter(e => e.date === ds),
      ...s.trainings.filter(t => t.date === ds).map(t => ({ type: 'TRAINING', title: t.name, time: t.time, id: t.id })),
      ...s.matches.filter(m => m.date === ds).map(m => ({ type: 'MATCH', title: 'vs ' + m.opponent, time: m.time, id: m.id }))
    ];

    return `
      <div class="st">Календар
        <div style="display:flex;gap:5px">
          <button class="btn btn-s btn-sm" data-action="cal-prev">←</button>
          <button class="btn btn-s btn-sm" data-action="cal-next">→</button>
          <button class="btn btn-p btn-sm" data-action="new-event">+ Подія</button>
        </div>
      </div>
      <div class="ch"><strong>${title}</strong></div>
      ${grid}
      <div class="card" style="margin-top:12px"><div class="ct">Події ${ds}</div>
        ${events.length ? events.map(e => {
        const openAttr = e.type === 'TRAINING' && e.id ? ` data-edit-training="${e.id}"` : (e.type === 'MATCH' && e.id ? ` data-view-match="${e.id}"` : '');
        return `<div class="li"${openAttr} style="cursor:pointer"><div class="inf"><div class="ti">${sanitize(e.title || e.name)}</div><div class="me">${e.type || e.eventType} · ${e.time || ''}</div></div></div>`;
      }).join('') : '<div style="color:var(--muted);font-size:12px">Немає подій</div>'}
      </div>
      <div class="card"><div class="ct">Мікроцикл / Шаблони</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-s btn-sm" data-action="microcycle">Авто-мікроцикл</button>
          <button class="btn btn-s btn-sm" data-tpl="md-1">MD-1</button>
          <button class="btn btn-s btn-sm" data-tpl="md">Match Day</button>
          <button class="btn btn-s btn-sm" data-tpl="md+1">MD+1</button>
        </div>
        <p class="note-sm">MD+1 Recovery → MD+2 Tech → … → MD-1 Activation → MD Match</p>
      </div>`;
  },

  matches() {
    const s = Store.get();
    return `
      <div class="st">Матчі <button class="btn btn-p btn-sm" data-action="new-match">+ Матч</button></div>
      ${s.matches.length ? s.matches.map(m => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <div><strong>${m.home ? 'МЕТАЛІСТ ШТУТГАРТ' : sanitize(m.opponent)} vs ${m.home ? sanitize(m.opponent) : 'МЕТАЛІСТ ШТУТГАРТ'}</strong>
              <div class="me" style="font-size:11px;color:var(--muted);margin-top:3px">${m.date} ${m.time || ''} · ${sanitize(m.stadium || '')} · ${m.scheme || ''}</div>
            </div>
            <div style="display:flex;gap:3px">
              <button class="btn btn-s btn-sm" data-view-match="${m.id}">Деталі</button>
              <button class="btn btn-d btn-sm" data-del-match="${m.id}">✕</button>
            </div>
          </div>
        </div>`).join('') : '<div class="es"><div class="ic">🏆</div>Немає матчів</div>'}`;
  },

  analytics() {
    const s = Store.get();
    const past = LoadModel.pastTrainings(s.trainings);
    const summary = LoadModel.teamSummary(s.trainings, s.players);
    const sessions = LoadModel.attendanceBySession(s.trainings);
    const withAtt = past.filter(t => t.attendance && Object.keys(t.attendance).length);

    // SVG chart: attendance % per session
    let chartSvg = '';
    if (sessions.length) {
      const W = 320, H = 150, padL = 28, padR = 8, padT = 16, padB = 28;
      const n = sessions.length;
      const gap = 4;
      const barW = Math.max(6, (W - padL - padR - gap * (n - 1)) / n);
      let bars = '';
      sessions.forEach((sess, i) => {
        const h = Math.round((sess.pct / 100) * (H - padT - padB));
        const x = padL + i * (barW + gap);
        const y = H - padB - h;
        const col = sess.pct >= 80 ? '#2ecc71' : (sess.pct >= 50 ? '#f1c40f' : '#e74c3c');
        bars += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(2, h)}" rx="3" fill="${col}"/>`;
        if (n <= 10 || i % Math.ceil(n / 8) === 0) {
          const lab = (sess.date || '').slice(5); // MM-DD
          bars += `<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle" fill="#9aa4b2" font-size="8">${lab}</text>`;
        }
      });
      chartSvg = `<div class="card glass"><div class="ct">Відвідуваність по тренуваннях (лише минулі)</div>
        <svg class="att-chart" viewBox="0 0 ${W} ${H}" width="100%" height="150" aria-label="Графік відвідуваності">
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="rgba(255,255,255,0.08)"/>
          <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="rgba(255,255,255,0.08)"/>
          <text x="4" y="${padT + 4}" fill="#9aa4b2" font-size="9">100%</text>
          <text x="4" y="${H - padB}" fill="#9aa4b2" font-size="9">0</text>
          ${bars}
        </svg>
        <div class="note-sm">Стовпчик = % присутніх серед відмічених на сесії</div>
      </div>`;
    } else {
      chartSvg = `<div class="card"><div class="ct">Відвідуваність по тренуваннях</div>
        <div class="es">Немає минулих сесій з відмітками відвідування</div></div>`;
    }

    return `
      <div class="st">Аналітика
        <button type="button" class="btn btn-s btn-sm" data-io="export" data-action="export">Експорт</button>
      </div>
      <p class="note-sm">Ураховуються лише тренування з датою ≤ сьогодні (без майбутніх і без скасованих). Навантаження = Тривалість × RPE.</p>
      <div class="dg">
        <div class="sc"><div class="lb">Минулих тренувань</div><div class="vl">${summary.count}</div></div>
        <div class="sc"><div class="lb">Загальний час</div><div class="vl">${summary.totalMin}<span style="font-size:13px"> хв</span></div></div>
        <div class="sc"><div class="lb">Сер. інтенсивність</div><div class="vl">${summary.avgInt}</div></div>
        <div class="sc"><div class="lb">Тижневий LOAD</div><div class="vl">${summary.weekLoad}</div></div>
        <div class="sc"><div class="lb">Відвідуваність</div><div class="vl">${summary.overallAtt != null ? summary.overallAtt + '%' : '—'}</div>
          <div class="sb">${summary.sessionsWithAtt} сесій з відмітками</div></div>
      </div>
      ${chartSvg}
      <div class="card"><div class="ct">Сесії · відвідування
        <button type="button" class="btn btn-s btn-sm" style="margin-left:auto" data-view="trainings">До тренувань</button>
      </div>
        ${withAtt.length ? withAtt.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10).map(t => {
          const vals = Object.values(t.attendance || {});
          const pr = vals.filter(a => a.present).length;
          return `<div class="li"><div class="inf"><div class="ti">${sanitize(t.name)}</div>
            <div class="me">${t.date || ''} · ${pr}/${vals.length} присутні · RPE ${t.intensity || '—'}</div></div>
            <button type="button" class="btn btn-s btn-sm" data-attendance-training="${t.id}">✎ Відмітки</button></div>`;
        }).join('') : '<div class="es">Ще немає відміток. Утримуйте картку тренування → «Відвідування».</div>'}
      </div>
      <div class="card"><div class="ct">Індивідуальне навантаження та відвідуваність</div>
        ${s.players.slice().sort((a, b) => {
          const la = LoadModel.playerLoad(s.trainings, a.id, 28);
          const lb = LoadModel.playerLoad(s.trainings, b.id, 28);
          return lb - la;
        }).map(p => {
          const rate = LoadModel.attendanceRate(s.trainings, p.id);
          const avgRpe = LoadModel.avgPlayerRpe(s.trainings, p.id);
          const pload = LoadModel.playerLoad(s.trainings, p.id, 28);
          const bar = avgRpe != null ? avgRpe : (p.load || 0);
          const lc = bar < 4 ? 'll' : (bar < 7 ? 'lm' : 'lh');
          const tg = p.telegramUsername ? ' · @' + sanitize(p.telegramUsername) : '';
          return `<div class="li"><div class="inf"><div class="ti">${p.number}. ${sanitize(p.firstName)} ${sanitize(p.lastName)}</div>
            <div class="me">${p.position} · готовність ${p.condition ?? p.readiness ?? '—'}%${tg}
              ${rate != null ? ' · відвідув. ' + rate + '%' : ''}
              ${avgRpe != null ? ' · сер. RPE ' + avgRpe : ''}
              ${pload ? ' · load 28д ' + pload : ''}
            </div></div>
            <div style="min-width:70px"><div class="lb2"><div class="lbf ${lc}" style="width:${Math.min(100, bar * 10)}%"></div></div></div>
          </div>`;
        }).join('')}
      </div>`;
  },

  settings() {
    try {
      const root = Store.get() || {};
      const s = root.settings || {};
      const rbac = s.rbac || { coaches: [], playerLinks: {} };
      const coachesStr = sanitize((rbac.coaches || []).join(', '));
      let linksStr = '{}';
      try { linksStr = sanitize(JSON.stringify(rbac.playerLinks || {})); } catch (_) { linksStr = '{}'; }
      const pri = s.primary || '#1a3a5c';
      const acc = s.accent || '#c8a84b';
      return `
      <div class="st">Налаштування</div>
      <div class="card glass coach-tools-settings">
        <div class="ct">Telegram · інструменти тренера</div>
        <p class="note-sm">Синхронізація Cloud Storage, шеринг плану та складу в чат команди.</p>
        <div class="coach-tools-grid">
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="sync-push">☁ Зберегти в Cloud</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="sync-pull">☁ Завантажити з Cloud</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="share-training">📤 План у чат</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="share-roster">👥 Склад у чат</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="export">📦 Експорт JSON</button>
        </div>
        <p class="note-sm" id="tgStatusLine" style="margin-top:8px"></p>
      </div>

      <div class="card"><div class="ct">Клуб</div>
        <div class="fg">
          <div class="fgr"><label>Назва</label><input id="setName" value="${sanitize(s.clubName || 'МЕТАЛІСТ ШТУТГАРТ')}"></div>
          <div class="fgr"><label>Скорочення</label><input id="setShort" value="${sanitize(s.clubShort || 'МШ')}" maxlength="4"></div>
          <div class="fgr"><label>Основний колір</label><input type="color" id="setPri" value="${pri}"></div>
          <div class="fgr"><label>Акцент</label><input type="color" id="setAcc" value="${acc}"></div>
          <div class="fgr"><label>Тривалість за замовч. (хв)</label><input type="number" id="setDur" value="${s.defaultDuration != null ? s.defaultDuration : 90}"></div>
          <div class="fgr"><label>Інтенсивність за замовч.</label><input type="number" id="setInt" value="${s.defaultIntensity != null ? s.defaultIntensity : 6}" min="1" max="10"></div>
          <div class="fgr full"><label>Логотип (завантажити зображення)</label>
            <input type="file" id="setLogo" accept="image/*">
            ${s.logoData ? '<p class="note-sm">Логотип завантажено</p>' : '<p class="note-sm">Placeholder: CLUB LOGO</p>'}
          </div>
          <div class="fgr"><label><input type="checkbox" id="setAuto" ${s.autosave !== false ? 'checked' : ''}> Автозбереження</label></div>
          <div class="fgr"><label><input type="checkbox" id="setSound" ${s.sound !== false ? 'checked' : ''}> Звук таймера</label></div>
        </div>
        <div class="fa"><button type="button" class="btn btn-p" data-action="save-settings">Зберегти</button></div>
      </div>
      <div class="card"><div class="ct">Дані</div>
        <div class="fa" style="flex-direction:column;align-items:stretch;gap:10px">
          <div class="data-io glass-io">
            <button type="button" class="btn btn-p data-io-btn coach-only" id="btnExportJson" data-io="export" data-action="export">Експорт JSON</button>
            <button type="button" class="btn btn-s data-io-btn" id="btnImportJson" data-io="import" data-action="import-trigger">Імпорт JSON</button>
          </div>
          <p class="note-sm">На iPhone: «Файли» / iCloud Drive. Перед імпортом створюється резервна копія.</p>
          <button type="button" class="btn btn-d" data-action="reset-all">Скинути все</button>
        </div>
      </div>
      <div class="card"><div class="ct">Ролі та Telegram (RBAC)</div>
        <p class="note-sm" style="margin-bottom:10px">Тренер завжди @Serdiuk_Artem. Гравець @Artem_Serdyuk визначається з анкети (Telegram). Імпорт JSON доступний усім.</p>
        <div class="fgr full"><label>Тренері (через кому)</label>
          <input type="text" id="setCoaches" value="${coachesStr}" placeholder="Serdiuk_Artem">
        </div>
        <div class="fgr full"><label>Прив'язка гравців (JSON)</label>
          <textarea id="setPlayerLinks" rows="3" placeholder='{"123":"p01"}'>${linksStr}</textarea>
        </div>
        <p class="note-sm">Поточний користувач: <strong id="rbacMe">—</strong></p>
        <button type="button" class="btn btn-s" data-action="save-rbac">Зберегти ролі</button>
      </div>
      <div class="card"><div class="ct">Про застосунок</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.6">
          Тренерська платформа · МЕТАЛІСТ ШТУТГАРТ<br>
          Schema v${typeof SCHEMA_VERSION !== 'undefined' ? SCHEMA_VERSION : 2} · localStorage · Telegram Cloud<br>
          Production-quality prototype
        </p>
      </div>`;
    } catch (e) {
      console.error('[Views.settings]', e);
      return `
        <div class="st">Налаштування</div>
        <div class="card">
          <div class="ct">Помилка відображення</div>
          <p class="note-sm">${sanitize(e && e.message ? e.message : String(e))}</p>
          <div class="data-io glass-io" style="margin-top:12px">
            <button type="button" class="btn btn-p data-io-btn coach-only" data-io="export" data-action="export">Експорт JSON</button>
            <button type="button" class="btn btn-s data-io-btn" data-io="import" data-action="import-trigger">Імпорт JSON</button>
          </div>
          <button type="button" class="btn btn-s" data-action="save-settings" style="margin-top:8px">Спробувати зберегти</button>
        </div>`;
    }
  },

  /* ─── 3-DEFENDER / MY EX / DIARY ─── */
/* ─── 3-DEFENDER TACTICAL CENTER ─── */
  back3() {
    const s = Store.get();
    const phasesHtml = Object.entries(BACK3.phases).map(([key, ph]) => `
      <div class="card" style="margin-bottom:12px">
        <div class="ct">${ph.label}</div>
        <div class="sg" style="flex-wrap:wrap;gap:6px">
          ${ph.items.map(it => `
            <button class="sb2" data-b3-phase="${it.scheme}" data-b3-name="${it.name}" title="${it.desc}"
              style="min-width:120px;text-align:left;padding:10px 12px">
              <strong>${it.name}</strong><br>
              <span style="font-size:10px;color:var(--muted)">${it.scheme}</span>
            </button>`).join('')}
        </div>
      </div>`).join('');

    const rolesHtml = Object.entries(BACK3.roles).map(([role, acts]) => `
      <div class="li"><div class="inf">
        <div class="ti">${role}</div>
        <div class="me">${acts.join(' · ')}</div>
      </div></div>`).join('');

    const rotHtml = BACK3.rotations.map(r => `
      <button class="sb2" data-b3-rot="${r.name}" style="text-align:left;padding:8px 10px;min-width:140px">
        <strong>${r.name}</strong><br><span style="font-size:10px;color:var(--muted)">${r.desc}</span>
      </button>`).join('');

    const ovHtml = BACK3.overloads.map(o => `
      <div class="sc" style="min-width:140px"><div class="lb">${o.name}</div><div class="sb">${o.desc}</div></div>`).join('');

    const formBtns = BACK3.formations.map(f =>
      `<button class="sb2 ${f.startsWith('3')?'':''}" data-scheme="${f}" style="font-weight:700">${f}</button>`).join('');

    return `
      <div class="st">3️⃣ 3-Defender Tactical Center
        <button class="btn btn-p btn-sm" data-action="open-default-board">Відкрити дошку (логотип)</button>
      </div>
      <p class="note-sm" style="margin-bottom:12px">Професійний workspace для back three: фази гри, ролі, ротації, overload. Одна команда — багато структур.</p>

      <div class="card"><div class="ct">Формації з 3 захисниками</div>
        <div class="sg">${formBtns}</div>
      </div>

      <div class="st" style="font-size:15px;margin-top:16px">Фази гри (одна команда → різні структури)</div>
      ${phasesHtml}

      <div class="card"><div class="ct">Ролі Back Three + Wing-backs</div>
        ${rolesHtml}
      </div>

      <div class="card"><div class="ct">Ротації</div>
        <div class="sg">${rotHtml}</div>
      </div>

      <div class="card"><div class="ct">Numerical superiority / Overload</div>
        <div class="dg">${ovHtml}</div>
      </div>

      <div class="card"><div class="ct">Швидкі сценарії на дошці</div>
        <div class="sg">
          <button class="btn btn-p" data-b3-phase="3-2-build" data-b3-name="Build-up 3-2">▶ Build-up 3-2</button>
          <button class="btn btn-p" data-b3-phase="3-2-5-atk" data-b3-name="Attack 3-2-5">▶ Attack 3-2-5</button>
          <button class="btn btn-p" data-b3-phase="5-2-3" data-b3-name="Mid block 5-2-3">▶ Mid block</button>
          <button class="btn btn-p" data-b3-phase="3-4-3" data-b3-name="High press 3-4-3">▶ High press</button>
          <button class="btn btn-s" data-action="save-b3-anim">💾 Зберегти анімацію фази</button>
        </div>
      </div>`;
  },

  /* ─── MY EXERCISES ─── */
  myex() {
    const list = Store.get().myExercises || [];
    return `
      <div class="st">Мої вправи
        <button class="btn btn-p btn-sm" data-action="new-myex">+ Створити</button>
        <button class="btn btn-s btn-sm" data-action="myex-from-board">З дошки</button>
      </div>
      <p class="note-sm">Власні вправи з тактичною дошкою та анімацією. Можна додати в тренування.</p>
      ${list.length ? list.map(e => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <strong>${sanitize(e.name)}</strong>
              <div class="me">${e.category || '—'} · ${e.duration || 0}хв · RPE ${e.intensity || '—'}
                ${(e.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}
              </div>
              <div class="me">${sanitize(e.objective || '')}</div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              ${e.board ? `<button class="btn btn-s btn-sm" data-load-myex-board="${e.id}">⚽ Дошка</button>` : ''}
              ${e.animationId ? `<button class="btn btn-s btn-sm" data-play-anim="${e.animationId}">▶ Anim</button>` : ''}
              <button class="btn btn-s btn-sm" data-add-myex-tr="${e.id}">+ У тренування</button>
              <button class="btn btn-d btn-sm" data-del-myex="${e.id}">✕</button>
            </div>
          </div>
          ${e.coachingPoints ? `<div class="note-sm" style="margin-top:6px"><b>CP:</b> ${sanitize(e.coachingPoints)}</div>` : ''}
        </div>`).join('') : '<div class="es">Немає власних вправ. Створіть або збережіть з дошки.</div>'}`;
  },

  /* ─── COACH DIARY ─── */
  diary() {
    const list = (Store.get().diary || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const cats = ['Match Reflection','Training Reflection','Tactical Idea','Player Observation','Team Observation','Problem','Solution','Goal','Meeting','Personal Note'];
    return `
      <div class="st">📓 Щоденник тренера
        <button class="btn btn-p btn-sm" data-action="new-diary">+ Запис</button>
      </div>
      <p class="note-sm">Нотатки + тактичні схеми. При створенні запису або з дошки (📓) можна зберегти знімок поля.</p>
      <div class="sg" style="margin-bottom:12px;flex-wrap:wrap">
        ${cats.map(c => `<button class="sb2" data-diary-filter="${c}" style="font-size:11px">${c}</button>`).join('')}
        <button class="sb2" data-diary-filter="all">Усі</button>
      </div>
      <div id="diaryList">
      ${list.length ? list.map(d => `
        <div class="card" data-diary-cat="${sanitize(d.category||'')}">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <div>
              <div class="me">${d.date || ''} · <span style="color:var(--accent)">${sanitize(d.category||'')}</span>
                ${d.mood ? ' · ' + d.mood : ''}
              </div>
              <strong>${sanitize(d.title || 'Без назви')}</strong>
              <div style="font-size:13px;margin-top:4px;white-space:pre-wrap">${sanitize(d.text || '')}</div>
              ${d.playerId ? `<div class="me">👤 Гравець: ${d.playerId}</div>` : ''}
              ${d.tags && d.tags.length ? `<div class="me">${d.tags.map(t=>'#'+t).join(' ')}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${d.board ? `<button class="btn btn-p btn-sm" data-load-diary-board="${d.id}" title="Відкрити прикріплену дошку">⚽ Дошка${d.boardObjCount ? ' · ' + d.boardObjCount : (d.board.objects ? ' · ' + d.board.objects.length : '')}</button>` : `<button class="btn btn-s btn-sm" data-attach-diary-board="${d.id}" title="Прикріпити поточну дошку">📌 +Дошка</button>`}
              <button class="btn btn-s btn-sm" data-edit-diary="${d.id}">✎</button>
              <button class="btn btn-d btn-sm" data-del-diary="${d.id}">✕</button>
            </div>
          </div>
        </div>`).join('') : '<div class="es">Щоденник порожній. Додайте перший запис.</div>'}
      </div>`;
  },
};
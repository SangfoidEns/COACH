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


  _initials(name) {
    const p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return 'МШ';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return ((p[0][0] || '') + (p[p.length - 1][0] || '')).toUpperCase();
  },
  _cleanDisplayName(name) {
    return String(name || '')
      .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
      .replace(/[\uFE00-\uFE0F]/g, '')
      .replace(/[\u2600-\u27BF]/g, '')
      .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  _posAccent(pos) {
    const p = String(pos || '').toUpperCase();
    if (p === 'GK' || p.includes('GK')) return { bg: 'linear-gradient(145deg,#f1c40f33,#f39c1222)', ring: '#f1c40f', label: 'GK' };
    if (/^CB|^LB|^RB|^LCB|^RCB|^WB|DEF/.test(p)) return { bg: 'linear-gradient(145deg,#3498db33,#2980b922)', ring: '#3498db', label: p };
    if (/^CM|^CDM|^CAM|^LM|^RM|^DM|MID/.test(p)) return { bg: 'linear-gradient(145deg,#2ecc7133,#27ae6022)', ring: '#2ecc71', label: p };
    if (/^ST|^CF|^LW|^RW|^SS|ATT|FW/.test(p)) return { bg: 'linear-gradient(145deg,#e74c3c33,#c0392b22)', ring: '#e74c3c', label: p };
    return { bg: 'linear-gradient(145deg,#9b59b633,#8e44ad22)', ring: '#e8c547', label: p || 'COACH' };
  },

  _attendanceGifts(attPct) {
    const n = Math.max(0, Math.min(12, Math.round((Number(attPct) || 0) / 100 * 12)));
    const pool = ['★','●','◆','✦','★','●','◆','✦','★','●','◆','✦'];
    return pool.slice(0, Math.max(3, n)); // мінімум 3 для естетики профілю
  },


  /** Telegram-style gifts: scatter around avatar (not on face), expand animation */

  _giftStrip(gifts) {
    const list = (gifts || []).filter(Boolean);
    if (!list.length) return '';
    const show = list.slice(0, 12);
    return '<div class="tg-gift-strip" aria-label="Подарунки">' +
      show.map(g => {
        const rar = g.rarity || 'common';
        const hue = g.hue != null ? g.hue : 42;
        const title = sanitize((g.label || '') + (g.note ? (' — ' + g.note) : ''));
        const holo = g.special === 'metalist-holo-emblem' || g.giftId === 'metalist_holo_emblem';
        return '<button type="button" class="tg-gift-strip-item rarity-' + rar + (holo ? ' art-metalist-holo-emblem' : '') +
          '" style="--art-hue:' + hue + '" title="' + title +
          '" data-action="inspect-artifact" data-gift-uid="' + (g.id || '') +
          '" data-gift-id="' + (g.giftId || '') + '">' +
          (holo && typeof MetalistHoloEmblem !== 'undefined' ? MetalistHoloEmblem.markup() : '<span class="nft-art-ico">' + (g.ico || '★') + '</span>') + '</button>';
      }).join('') +
      (list.length > 12 ? ('<span class="tg-gift-more">+' + (list.length - 12) + '</span>') : '') +
      '</div>';
  },

  _tgGiftCloud(gifts, radiusScale, mode) {
    // mode: 'full' | 'right3' | 'mini3'
    // Always show attached gifts around avatar (Telegram-style scatter)
    let list = (gifts || []).filter(Boolean);
    // Prefer attached; if none flagged, show all (legacy data)
    const attached = list.filter(g => g.attached !== false);
    if (attached.length) list = attached;
    if (!list.length) return '';
    const sc = radiusScale != null ? radiusScale : 1;
    let slots, take;
    if (mode === 'right3') {
      take = list.slice(0, 3);
      slots = [{ x: 52, y: -30 }, { x: 62, y: 6 }, { x: 50, y: 38 }];
    } else if (mode === 'mini3') {
      take = list.slice(0, 3);
      slots = [{ x: 36, y: -30 }, { x: 42, y: 4 }, { x: 34, y: 32 }];
    } else {
      take = list.slice(0, 10);
      slots = [
        { x: -96, y: -48 }, { x: 100, y: -44 }, { x: -92, y: 54 },
        { x: 94, y: 58 }, { x: -40, y: -92 }, { x: 44, y: -94 },
        { x: -112, y: 6 }, { x: 116, y: 10 }, { x: -72, y: -76 },
        { x: 76, y: 82 }
      ];
    }
    const items = take.map((g, i) => {
      const s = slots[i % slots.length];
      const x = (s.x * sc);
      const y = (s.y * sc);
      const rar = g.rarity || 'common';
      const hue = g.hue != null ? g.hue : 42;
      const title = sanitize((g.label || '') + (g.serial ? (' · ' + g.serial) : '') + (g.note ? (' — ' + g.note) : ''));
      let special = '';
      if (g.special === 'metalist-holo-emblem' || g.giftId === 'metalist_holo_emblem') special = ' art-metalist-holo-emblem';
      else if (g.special === 'neural-horse' || g.giftId === 'neural_horse_tester') special = ' art-neural-horse';
      else if (g.special === 'golden-ball' || g.giftId === 'tyshchenko_first_golden_ball') special = ' art-golden-ball';
      else if (g.special) special = ' art-' + String(g.special).replace(/[^a-z0-9-]/gi, '');
      // Inline transform as hard fallback (works even if CSS vars fail)
      return '<span class="tg-gift-item nft-art rarity-' + rar + special + ' anim-' + (g.anim || 'float') +
        '" style="--gx:' + x.toFixed(1) + 'px;--gy:' + y.toFixed(1) + 'px;--gi:' + i +
        ';--art-hue:' + hue + ';--art-pattern:' + (g.pattern || 0) +
        ';transform:translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(1);opacity:1;visibility:visible"' +
        ' title="' + title +
        '" data-gift-id="' + (g.giftId || '') + '" data-action="inspect-artifact" data-gift-uid="' + (g.id || '') + '">' +
        (special === ' art-metalist-holo-emblem' && typeof MetalistHoloEmblem !== 'undefined' ? MetalistHoloEmblem.markup() : '<span class="nft-art-core" aria-hidden="true"></span>' +
        '<span class="nft-art-ico tg-emoji-anim anim-' + (g.anim || 'float') + '">' + (g.mediaUrl ? ('<img class="tg-emoji-media" src="' + String(g.mediaUrl).replace(/"/g,'') + '" alt="">') : (g.ico || '★')) + '</span>') +
        '<span class="nft-art-wave" aria-hidden="true"></span></span>';
    }).join('');
    return '<div class="tg-gift-cloud tg-gift-expand mode-' + (mode || 'full') +
      '" aria-hidden="false" style="opacity:1;visibility:visible;pointer-events:none">' + items + '</div>';
  },

  /** Status chip near name — featured artifact only (Telegram-style) */
  _giftStatusBadge(gifts, playerId) {
    let g = null;
    try {
      if (playerId && typeof CoachTools !== 'undefined' && CoachTools.getFeaturedGift)
        g = CoachTools.getFeaturedGift(playerId);
    } catch (_) {}
    if (!g) {
      const list = (gifts || []).filter(x => x && x.attached !== false);
      if (!list.length) return '';
      const rank = { legendary: 4, epic: 3, rare: 2, common: 1 };
      list.sort((a, b) => (rank[b.rarity] || 0) - (rank[a.rarity] || 0));
      g = list[0];
    }
    if (!g) return '';
    const rar = g.rarity || 'common';
    const extra = (gifts && gifts.length > 1) ? ('+' + (gifts.length - 1)) : '';
    return '<span class="gift-status-badge rarity-' + rar + '" title="' +
      sanitize((g.label || '') + (g.serial ? (' · ' + g.serial) : '') + (g.note ? (' — ' + g.note) : '')) + '">' +
      (g.ico || '★') + extra + '</span>';
  },


  _coachSquadCard() {
    const s = Store.get();
    const set = s.settings || {};
    let name = set.coachName || 'Artem Serdiuk';
    let photo = set.coachPhoto || '';
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.displayName) name = AuthManager.displayName() || name;
      if (!photo && typeof TelegramManager !== 'undefined' && TelegramManager.getUser) {
        const u = TelegramManager.getUser();
        if (u && u.photo_url) photo = u.photo_url;
      }
    } catch (_) {}
    const ach = (typeof CoachTools !== 'undefined' && CoachTools.getCoachAchievements)
      ? CoachTools.getCoachAchievements()
      : { attendancePct: 100, appMs: 0, boardMs: 0, trainingsDone: 0, boards: 0 };
    const fmt = (ms) => {
      if (!ms) return '0хв';
      const m = Math.round(ms / 60000);
      if (m < 60) return m + 'хв';
      return (Math.round(m / 6) / 10) + 'г';
    };
    const initials = (name || 'AS').split(/\s+/).map(p => p[0] || '').join('').slice(0, 2).toUpperCase();
    const ph = photo
      ? '<img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"/>'
      : '<span class="cp-avatar-ph">' + sanitize(initials) + '</span>';
    return '<div class="pl-card glass coach-squad-card is-coach" data-action="open-coach-card" role="button" tabindex="0">' +
      '<div class="pl-card-av-wrap"><div class="pl-card-av coach-av" style="border-color:#f0c14b;background:linear-gradient(145deg,#3d2e0a,#1a1408)">' + ph + '</div></div>' +
      '<div class="pl-card-body">' +
      '<div class="pl-card-name">★ ' + sanitize(name) + '</div>' +
      '<div class="pl-card-meta">Головний тренер · METALIST</div>' +
      '<div class="pl-card-att">Відвідуваність ' + (ach.attendancePct || 0) + '%</div>' +
      '<div class="coach-mini-stats">' +
        '<span title="У додатку">📱 ' + fmt(ach.appMs) + '</span>' +
        '<span title="На дошці">⚽ ' + fmt(ach.boardMs) + '</span>' +
        '<span title="Проведено">✓ ' + (ach.trainingsDone || 0) + '</span>' +
        '<span title="Схеми">📋 ' + (ach.boards || 0) + '</span>' +
      '</div></div></div>';
  },

  _profilePersonCard() {
    const s = Store.get();
    let person = null;
    let kind = 'coach';
    try {
      if (typeof AuthManager !== 'undefined') {
        if (AuthManager.isPlayer && AuthManager.isPlayer()) {
          person = AuthManager.getLinkedPlayer && AuthManager.getLinkedPlayer();
          kind = 'player';
        }
      }
    } catch (_) {}
    if (!person && kind === 'coach') {
      // тренер: з TG user або settings
      let photo = '';
      let name = 'Artem Serdiuk';
      try {
        if (typeof AuthManager !== 'undefined') name = AuthManager.displayName() || name;
        if (typeof TelegramManager !== 'undefined') {
          const u = TelegramManager.getUser && TelegramManager.getUser();
          if (u && u.photo_url) photo = u.photo_url;
          if (u && (u.first_name || u.last_name)) name = [u.first_name, u.last_name].filter(Boolean).join(' ');
        }
      } catch (_) {}
      // coach photo from settings if uploaded
      try {
        if (s.settings && s.settings.coachPhoto) photo = s.settings.coachPhoto;
      } catch (_) {}
      const gifts = [];
      const acc = this._posAccent('COACH');
      return { kind: 'coach', name: this._cleanDisplayName(name), photo, pos: 'ГОЛОВНИЙ ТРЕНЕР', accent: acc, gifts, attPct: 85, initials: this._initials(name) };
    }
    if (person) {
      const photo = this._resolvePlayerAvatar(person) || person.photoUrl || '';
      const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.name || 'Гравець';
      let attPct = 70;
      try {
        if (typeof LoadModel !== 'undefined' && LoadModel.attendanceRate) {
          attPct = LoadModel.attendanceRate(s.trainings, person.id) || 0;
        }
      } catch (_) {}
      let gifts = [];
      try {
        if (typeof CoachTools !== 'undefined' && CoachTools.playerGifts) {
          gifts = CoachTools.playerGifts(person.id) || [];
        } else {
          gifts = (s.gifts || []).filter(g => g.playerId === person.id);
        }
      } catch (_) {}
      const acc = this._posAccent(person.position);
      return { kind: 'player', name: this._cleanDisplayName(name), photo, pos: person.position || '—', accent: acc, gifts, attPct, player: person, initials: this._initials(name) };
    }
    return null;
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
    const totalMin = pastForStats.reduce((a, t) => a + (t.duration || 0), 0);
    const nextMatch = s.matches.filter(m => m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const recent = s.trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
    const drafts = s.trainings.filter(t => t.status === 'draft' || t.status === 'pinned');
    const boardCount = (s.boards || []).length;
    const club = (s.settings && s.settings.clubName) || 'МЕТАЛІСТ ШТУТГАРТ';
    const short = (s.settings && s.settings.clubShort) || 'МШ';
    const logo = (s.settings && s.settings.logoData) || '';
    const coachName = (typeof AuthManager !== 'undefined' && AuthManager.displayName)
      ? AuthManager.displayName() : 'Artem Serdiuk';
    const coachRole = (typeof AuthManager !== 'undefined' && AuthManager.roleLabel)
      ? AuthManager.roleLabel() : 'Тренер';

    const matchHtml = nextMatch ? `
      <div class="cp-match">
        <div class="cp-match-teams">
          <span class="cp-match-us">${sanitize(short)}</span>
          <span class="cp-match-vs">VS</span>
          <span class="cp-match-them">${sanitize(nextMatch.opponent || 'Суперник')}</span>
        </div>
        <div class="cp-match-meta">${sanitize(nextMatch.date || '')}${nextMatch.time ? ' · ' + sanitize(nextMatch.time) : ''}</div>
      </div>` : `<div class="cp-match is-empty">Наступний матч не заплановано</div>`;

    const statusLabel = next
      ? ('Наступне: ' + (next.name || 'Тренування') + (next.date ? ' · ' + next.date : ''))
      : 'Немає запланованих тренувань';

    return `
      <div class="club-profile">
        <div class="app-build-tag" aria-hidden="true">build 2026.10.27-c · full</div>

        <!-- Telegram-style profile card (coach/player) -->
        ${(() => {
          const pc = this._profilePersonCard();
          if (!pc) return '';
          const avAction = pc.kind === 'coach'
            ? 'data-action="open-default-board"'
            : (pc.player && pc.player.id ? ('data-action="open-fifa-card" data-player-id="' + pc.player.id + '"') : '');
          const ph = pc.photo
            ? `<img src="${sanitize(pc.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"/><span class="cp-avatar-ph" style="display:none">${sanitize(pc.initials || '??')}</span>`
            : `<span class="cp-avatar-ph">${sanitize(pc.initials || '??')}</span>`;
          return `
        <div class="cp-hero cp-person cp-clean" style="--pos-bg:${pc.accent.bg};--pos-ring:${pc.accent.ring}">
          <div class="cp-avatar-wrap">
            <button type="button" class="cp-avatar" ${avAction}
              title="${pc.kind === 'coach' ? 'Дошка' : 'FIFA-картка'}"
              style="border-color:var(--pos-ring);background:var(--pos-bg)">
              ${ph}
            </button>
            ${this._tgGiftCloud(pc.gifts, 1.15, 'full')}
          </div>
          ${this._giftStrip(pc.gifts)}
          <div class="cp-role-line"><span class="cp-role-kind">${pc.kind === 'coach' ? 'Тренер' : 'Гравець'}</span></div>
          <h1 class="cp-title cp-title-name">${sanitize(pc.name)}${this._giftStatusBadge(pc.gifts)}</h1>
          <div class="cp-role-badge" ${pc.kind === 'coach' ? 'data-action="coach-easter" role="button" title="Утримуйте 1с · картка тренера"' : ''} style="border-color:var(--pos-ring);color:var(--pos-ring);cursor:${pc.kind === 'coach' ? 'pointer' : 'default'}">${sanitize(pc.pos)}</div>
          <div class="cp-club-line cp-club-brand"><span class="cp-brand-a">Металіст</span> <span class="cp-brand-b">Штутгарт</span></div>
          <div class="cp-status">
            <span class="cp-dot"></span>
            ${pc.kind === 'player'
              ? ('Відвідуваність ' + Math.round(pc.attPct || 0) + '% · тап по фото → FIFA')
              : sanitize(statusLabel)}
          </div>
        </div>`;
        })()}

        <!-- Quick pills -->
        <div class="cp-pills">
          <button type="button" class="cp-pill cp-pill-p" data-action="new-training">+ Нове тренування</button>
          <button type="button" class="cp-pill" data-view="tactics">Схеми</button>
          <button type="button" class="cp-pill" data-view="players">Склад</button>
          <button type="button" class="cp-pill" data-view="analytics">Статистика</button>
        </div>

        <!-- Stats glass grid -->
        <div class="cp-stats">
          <button type="button" class="cp-stat sc-tap" data-view="players">
            <span class="cp-stat-ic">👥</span>
            <span class="cp-stat-val">${avail}</span>
            <span class="cp-stat-lb">Гравців у строю</span>
            <span class="cp-stat-sub">з ${s.players.length} · травма ${injured}</span>
          </button>
          <div class="cp-stat">
            <span class="cp-stat-ic">⏱</span>
            <span class="cp-stat-val">${totalMin || totalHours}</span>
            <span class="cp-stat-lb">${totalMin ? 'хв загалом' : 'год'}</span>
            <span class="cp-stat-sub">${pastForStats.length} тренувань</span>
          </div>
          <div class="cp-stat">
            <span class="cp-stat-ic">📊</span>
            <span class="cp-stat-val">${weekLoad || 0}</span>
            <span class="cp-stat-lb">Тижневе навантаження</span>
            <span class="cp-stat-sub">Duration × RPE</span>
          </div>
          <div class="cp-stat">
            <span class="cp-stat-ic">🕐</span>
            <span class="cp-stat-val">${totalHours}</span>
            <span class="cp-stat-lb">Години тренувань</span>
            <span class="cp-stat-sub">лише минулі</span>
          </div>
          <div class="cp-stat cp-stat-wide">
            <span class="cp-stat-ic">📅</span>
            <span class="cp-stat-lb">Наступний матч</span>
            ${matchHtml}
          </div>
          <div class="cp-stat">
            <span class="cp-stat-ic">🗂</span>
            <span class="cp-stat-val">${boardCount}</span>
            <span class="cp-stat-lb">Схеми</span>
            <span class="cp-stat-sub">збережені дошки</span>
          </div>
        </div>

        <!-- Coach tools (collapse) -->
        <div class="coach-tools-collapse glass cp-block" id="coachToolsCollapse">
          <button type="button" class="coach-tools-handle" data-action="toggle-coach-tools" aria-expanded="false">
            <span>🛠 Інструменти тренера</span>
            <span class="note-sm">утримуйте або натисніть</span>
          </button>
          <div class="coach-tools-body" hidden>
            ${typeof CoachTools !== 'undefined' ? CoachTools.panelHtml() : ''}
          </div>
        </div>

        <!-- Recent trainings -->
        <div class="cp-section">
          <div class="cp-sec-head">
            <h2>Останні тренування</h2>
            <button type="button" class="cp-link" data-view="trainings">Переглянути всі ›</button>
          </div>
          <div class="cp-list">
            ${recent.length ? recent.map(t => {
              const st = t.status || 'planned';
              const stClass = st === 'cancelled' || st === 'canceled' ? 'is-cancel' : (st === 'done' || st === 'completed' ? 'is-done' : (st === 'draft' ? 'is-draft' : ''));
              return `<div class="cp-row card-training tg-row ${stClass}" data-training-id="${t.id}">
                <div class="cp-row-main">
                  <div class="cp-row-title">${sanitize(t.name || 'Тренування')}</div>
                  <div class="cp-row-meta">${sanitize(t.date || '')} · ${t.duration || 0}хв · ${sanitize(st)}</div>
                </div>
                <button type="button" class="cp-row-btn coach-only" data-edit-training="${t.id}">Відкрити</button>
              </div>`;
            }).join('') : '<div class="cp-empty">Немає тренувань</div>'}
          </div>
        </div>

        ${drafts.length ? `
        <div class="cp-section coach-only">
          <div class="cp-sec-head"><h2>Чернетки / Закріплені</h2></div>
          <div class="cp-list">
            ${drafts.map(t => `<div class="cp-row card-training tg-row" data-training-id="${t.id}">
              <div class="cp-row-main">
                <div class="cp-row-title">${sanitize(t.name || 'Чернетка')}</div>
                <div class="cp-row-meta"><span class="badge b-i">${sanitize(t.status)}</span></div>
              </div>
              <button type="button" class="cp-row-btn" data-edit-training="${t.id}">Відкрити</button>
            </div>`).join('')}
          </div>
        </div>` : ''}

        ${next ? `
        <div class="cp-section">
          <div class="cp-sec-head"><h2>Наступне тренування</h2></div>
          <div class="cp-row sc-next-training" data-next-training="${next.id}" role="button">
            <div class="cp-row-main">
              <div class="cp-row-title">${sanitize(next.name)}</div>
              <div class="cp-row-meta">${sanitize(next.date || '')}${next.time ? ' · ' + sanitize(next.time) : ''} · утримайте для плану</div>
            </div>
          </div>
        </div>` : ''}
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


  /** Telegram-style gift positions: irregular slots around avatar, outside the face */
  _giftSlots(n, radius) {
    const R = radius || 52;
    // fixed aesthetic slots (not perfect circle), order fills first
    const slots = [
      { a: -70, r: 1.05 }, { a: -20, r: 1.12 }, { a: 30, r: 1.08 },
      { a: 80, r: 1.15 }, { a: 140, r: 1.06 }, { a: 190, r: 1.14 },
      { a: 230, r: 1.10 }, { a: 280, r: 1.12 }
    ];
    const out = [];
    for (let i = 0; i < Math.min(n, slots.length); i++) {
      const s = slots[i];
      const rad = (s.a * Math.PI) / 180;
      out.push({
        x: Math.cos(rad) * R * s.r,
        y: Math.sin(rad) * R * s.r,
        i
      });
    }
    return out;
  },
  _renderGiftOrbit(gifts, radius) {
    if (!gifts || !gifts.length) return '';
    const list = gifts.slice(0, 8);
    const slots = this._giftSlots(list.length, radius || 52);
    return '<div class="tg-gift-orbit" aria-hidden="true">' + list.map((g, i) => {
      const s = slots[i] || { x: 0, y: 0, i };
      return '<span class="tg-gift" style="--gx:' + s.x.toFixed(1) + 'px;--gy:' + s.y.toFixed(1) + 'px;--gi:' + i + '" title="' +
        (typeof sanitize === 'function' ? sanitize(g.label || '') : (g.label || '')) +
        (g.note ? (' — ' + (typeof sanitize === 'function' ? sanitize(g.note) : g.note)) : '') +
        '">' + (g.ico || '★') + '</span>';
    }).join('') + '</div>';
  },
  _renderGiftStatus(gifts) {
    if (!gifts || !gifts.length) return '';
    // compact status chips next to name (not on name text itself)
    return '<span class="tg-gift-status">' + gifts.slice(0, 4).map(g =>
      '<span class="tg-gift-badge" title="' + (typeof sanitize === 'function' ? sanitize(g.label || '') : (g.label || '')) + '">' + (g.ico || '★') + '</span>'
    ).join('') + '</span>';
  },

  _fifaCard(p, stats) {
    if (!p) return '';
    stats = stats || {};
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

    // Подарунки на FIFA-картці
    let gifts = [];
    try {
      if (typeof CoachTools !== 'undefined' && CoachTools.playerGifts) {
        gifts = (CoachTools.playerGifts(p.id) || []).filter(g => g.attached !== false);
      }
    } catch (_) {}
    const giftOrbit = this._tgGiftCloud(gifts, 1.05, 'right3');
    const giftRow = gifts.length
      ? ('<div class="fifa-gifts">' + gifts.slice(0, 10).map(g => {
          const rar = g.rarity || 'common';
          const rarL = (typeof CoachTools !== 'undefined' && CoachTools.RARITY_LABEL && CoachTools.RARITY_LABEL[rar]) || rar;
          const sp = (g.special === 'neural-horse' || g.giftId === 'neural_horse_tester') ? ' art-neural-horse' : '';
          return '<span class="fifa-gift-chip nft-chip rarity-' + rar + sp + '" style="--art-hue:' + (g.hue != null ? g.hue : 42) + '" title="' +
            sanitize((g.label || '') + (g.serial ? (' · ' + g.serial) : '') + (g.note ? (' — ' + g.note) : '')) +
            '" data-action="inspect-artifact" data-gift-uid="' + (g.id || '') + '">' +
            (g.ico || '★') + ' ' + sanitize(g.label || '') +
            '<small>' + sanitize(rarL) + (g.serial ? (' · ' + sanitize(g.serial)) : '') + '</small></span>';
        }).join('') + '</div>')
      : '<div class="fifa-gifts fifa-gifts-empty"><span class="note-sm">Артефактів ще немає</span></div>';

    // Порівняння — ТІЛЬКИ всередині FIFA-картки
    const otherId = (typeof window !== 'undefined' && (window.__fifaCompareId || window.__coachCompareId || window.__playerCompareId)) || '';
    const compareHtml = this._compareBlock(p, otherId);

    return `
      <div class="fifa-card glass" data-fifa-player="${p.id}" data-compare-host="${p.id}">
        <div class="fifa-shine"></div>
        <div class="fifa-top">
          <div class="fifa-ovr" style="border-color:${posColor}">
            <span class="fifa-ovr-num">${ovr}</span>
            <span class="fifa-pos" style="color:${posColor}">${sanitize(pos)}</span>
          </div>
          <div class="fifa-avatar-wrap">
            <div class="fifa-avatar" style="background:linear-gradient(145deg,${posColor}55,${posColor}22)">
              ${avatarInner}
              ${cap}
            </div>
            ${giftOrbit}
          </div>
          <div class="fifa-club">
            <img class="fifa-club-mark" src="assets/metalist-mark.svg" alt="" onerror="this.style.display='none'"/>
            <div class="fifa-club-text">
              <div class="fifa-club-name">МЕТАЛІСТ</div>
              <div class="fifa-club-sub">Штутгарт</div>
            </div>
          </div>
        </div>
        <div class="fifa-name">
          <span class="fifa-num">#${p.number || '—'}</span>
          ${sanitize(p.firstName || '')} <strong>${sanitize(p.lastName || '')}</strong>
          ${this._giftStatusBadge(gifts, p.id)}
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
        <div class="fifa-gifts-block">
          <div class="fifa-gifts-title">Артефакти клубу</div>
          ${giftRow}
          ${gifts.length ? ('<div class="fifa-featured-pick"><span class="note-sm">Біля імені:</span> ' + gifts.map(g =>
            '<button type="button" class="gift-feat-btn' + (g.featured ? ' on' : '') + '" data-action="set-featured-gift" data-player-id="' + p.id + '" data-gift-uid="' + g.id + '" title="Показати біля імені">' + (g.ico || '★') + '</button>'
          ).join('') + '</div>') : ''}
        </div>
        ${compareHtml}
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
    const opts = '<option value="">— оберіть гравця —</option>' +
      '<option value="__team__"' + (otherId === '__team__' ? ' selected' : '') + '>Середнє по команді</option>' +
      others.map(p =>
        '<option value="' + p.id + '"' + (otherId === p.id ? ' selected' : '') + '>#' + (p.number || '—') + ' ' + sanitize(p.lastName || p.firstName || '') + '</option>'
      ).join('');
    return `
      <div class="compare-card" data-compare-root="${me.id}">
        <div class="compare-title">Порівняння зі складом</div>
        <label class="compare-label">Порівняти з</label>
        <select id="playerCompareSel" class="compare-select" data-action="player-compare" data-compare-me="${me.id}">
          ${opts}
        </select>
        <p class="note-sm">Гравець або середнє по команді — готовність, відвідування, RPE, навантаження.</p>
        <div id="compareResultHost" class="compare-result-host">
          ${this._compareResultHtml(me, otherId)}
        </div>
      </div>`;
  },

  _compareResultHtml(me, otherId) {
    if (!me || !otherId) {
      return '<div class="compare-empty">Оберіть гравця або середнє по команді</div>';
    }
    const s = Store.get();
    const a = this._playerStats(me.id);
    const condA = me.readiness != null ? me.readiness : (me.condition != null ? me.condition : 80);
    const nameA = '#' + (me.number || '') + ' ' + sanitize(me.lastName || me.firstName || 'Ви');
    let condB = 0, b = { attPct: 0, avgRpe: 0, load28: 0 }, nameB = '', loadB = 0;
    if (otherId === '__team__') {
      const pls = s.players || [];
      if (!pls.length) return '<div class="compare-empty">Немає гравців</div>';
      let sumCond = 0, sumAtt = 0, sumRpe = 0, sumL28 = 0, sumLoad = 0, n = 0;
      pls.forEach(p => {
        n++;
        sumCond += (p.readiness != null ? p.readiness : (p.condition != null ? p.condition : 80));
        const st = this._playerStats(p.id);
        sumAtt += st.attPct || 0;
        sumRpe += st.avgRpe || 0;
        sumL28 += st.load28 || 0;
        sumLoad += (p.load != null ? p.load : 0);
      });
      condB = Math.round(sumCond / n);
      b = { attPct: Math.round(sumAtt / n), avgRpe: +(sumRpe / n).toFixed(1), load28: Math.round(sumL28 / n) };
      loadB = +(sumLoad / n).toFixed(1);
      nameB = 'Середнє · команда (' + n + ')';
    } else {
      const other = (s.players || []).find(p => p.id === otherId);
      if (!other) return '<div class="compare-empty">Гравець не знайдений</div>';
      b = this._playerStats(other.id);
      condB = other.readiness != null ? other.readiness : (other.condition != null ? other.condition : 80);
      nameB = '#' + (other.number || '') + ' ' + sanitize(other.lastName || other.firstName || '');
      loadB = other.load != null ? other.load : 0;
    }
    const maxLoad = Math.max(200, (a.load28 || 0) * 1.2, (b.load28 || 0) * 1.2);
    const fakeOther = { load: loadB };
    const chart = this._compareSvg(me, fakeOther, a, b, condA, condB);
    return `
      <div class="compare-grid">
        <div class="compare-col">
          <div class="compare-name">${nameA}</div>
          ${this._statBar('Готовність %', condA, 100, '#2ecc71')}
          ${this._statBar('Відвідування %', a.attPct || 0, 100, '#3498db')}
          ${this._statBar('Сер. RPE', a.avgRpe || 0, 10, '#f1c40f')}
          ${this._statBar('Load 28д', a.load28 || 0, maxLoad, '#e67e22')}
          ${this._statBar('Load', me.load != null ? me.load : 0, 10, '#9b59b6')}
        </div>
        <div class="compare-col">
          <div class="compare-name">${nameB}</div>
          ${this._statBar('Готовність %', condB, 100, '#2ecc71')}
          ${this._statBar('Відвідування %', b.attPct || 0, 100, '#3498db')}
          ${this._statBar('Сер. RPE', b.avgRpe || 0, 10, '#f1c40f')}
          ${this._statBar('Load 28д', b.load28 || 0, maxLoad, '#e67e22')}
          ${this._statBar('Load', loadB, 10, '#9b59b6')}
        </div>
      </div>
      <div class="compare-chart-wrap">${chart}</div>`;
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



  _myStatsCharts(me, stats) {
    if (!me) return '';
    const s = Store.get();
    const past = (s.trainings || []).filter(t => {
      if (t.status === 'cancelled') return false;
      if (t.status === 'done') return true;
      try { return t.date && t.date < today(); } catch (_) { return false; }
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const last12 = past.slice(-12);
    const attSeries = last12.map(t => {
      const a = t.attendance && t.attendance[me.id];
      if (!a) return 0;
      return a.present === false ? 0 : 1;
    });
    const rpeSeries = last12.map(t => {
      const a = t.attendance && t.attendance[me.id];
      return a && a.rpe != null ? Number(a.rpe) : null;
    });
    const W = 280, H = 72, pad = 4;
    const n = Math.max(1, attSeries.length);
    const barW = (W - pad * 2) / n;
    const bars = attSeries.map((v, i) => {
      const x = pad + i * barW;
      const h = v ? (H - pad * 2) * 0.85 : 4;
      const y = H - pad - h;
      const fill = v ? '#2ecc71' : '#e74c3c55';
      return `<rect x="${x + 1}" y="${y}" width="${Math.max(2, barW - 2)}" height="${h}" rx="2" fill="${fill}"/>`;
    }).join('');
    const rpePts = rpeSeries.map((v, i) => {
      if (v == null || isNaN(v)) return null;
      const x = pad + i * barW + barW / 2;
      const y = H - pad - ((Math.min(10, Math.max(0, v)) / 10) * (H - pad * 2));
      return `${x},${y}`;
    }).filter(Boolean);
    const poly = rpePts.length > 1
      ? `<polyline fill="none" stroke="#e8c547" stroke-width="2" points="${rpePts.join(' ')}"/>`
      : '';
    const presentCnt = attSeries.filter(Boolean).length;
    const totalCnt = attSeries.length;
    const attPct = totalCnt ? Math.round(presentCnt / totalCnt * 100) : (stats && stats.attPct) || 0;

    return `
      <div class="card glass player-stats-card">
        <div class="ct">Моя статистика · тренування</div>
        <div class="dg" style="margin-bottom:10px">
          <div class="sc"><div class="lb">Відвідуваність</div><div class="vl">${attPct}%</div><div class="sb">${presentCnt}/${totalCnt || '—'} останніх</div></div>
          <div class="sc"><div class="lb">Сер. RPE</div><div class="vl">${stats && stats.avgRpe != null ? stats.avgRpe : '—'}</div></div>
          <div class="sc"><div class="lb">Load 28д</div><div class="vl">${stats && stats.load28 != null ? stats.load28 : '—'}</div></div>
        </div>
        <div class="chart-label">Відвідування (зелене = був, червоне = відсутній)</div>
        <svg class="att-chart" viewBox="0 0 ${W} ${H}" width="100%" height="72" aria-label="Графік відвідування">${bars}${poly}</svg>
        <div class="chart-label" style="margin-top:6px">Жовта лінія — RPE на тренуваннях</div>
      </div>`;
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
    if (!me && AuthManager.user) {
      try { AuthManager._resolveRole(); me = AuthManager.getLinkedPlayer(); } catch (_) {}
    }
    const stats = me ? this._playerStats(me.id) : { attPct: 0, avgRpe: 0, load28: 0 };
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nextMatch = s.matches.filter(m => m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const pastTr = (s.trainings || []).filter(t => t.status === 'done' || (t.date && t.date < today() && t.status !== 'cancelled'))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
    const schemes = (s.boards || s.savedBoards || []).slice(0, 6);
    const club = (s.settings && s.settings.clubName) || 'Metalist Stuttgart';
    const fullName = me ? this._cleanDisplayName([me.firstName, me.lastName].filter(Boolean).join(' ') || me.name || 'Гравець') : '';
    let meGifts = [];
    try {
      if (me && typeof CoachTools !== 'undefined' && CoachTools.playerGifts) {
        meGifts = CoachTools.playerGifts(me.id) || [];
      } else if (me) {
        meGifts = ((Store.get().gifts || []).filter(g => g.playerId === me.id));
      }
    } catch (_) {}
    const pc = me ? {
      kind: 'player',
      name: fullName,
      photo: this._resolvePlayerAvatar(me) || me.photoUrl || '',
      pos: me.position || '—',
      accent: this._posAccent(me.position),
      attPct: stats.attPct || 0,
      player: me,
      initials: this._initials(fullName),
      gifts: meGifts
    } : null;
    const photoHtml = pc && pc.photo
      ? `<img src="${sanitize(pc.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')"/><span class="cp-avatar-ph" style="display:none">${sanitize(pc.initials)}</span>`
      : (pc ? `<span class="cp-avatar-ph">${sanitize(pc.initials)}</span>` : '');

    return `
      <div class="st">Мій кабінет · МЕТАЛІСТ ШТУТГАРТ
        <button type="button" class="btn btn-s btn-sm" data-io="import" data-action="import-trigger">Імпорт JSON</button>
        <button type="button" class="btn btn-s btn-sm" data-action="edit-self-player">Моя картка</button>
      </div>
      ${pc ? `
        <div class="cp-hero cp-person cp-clean" style="--pos-bg:${pc.accent.bg};--pos-ring:${pc.accent.ring}">
          <div class="cp-avatar-wrap">
            <button type="button" class="cp-avatar" data-action="open-fifa-card" data-player-id="${pc.player.id}"
              title="FIFA-картка" style="border-color:var(--pos-ring);background:var(--pos-bg)">
              ${photoHtml}
            </button>
            ${this._tgGiftCloud(pc.gifts, 1.15, 'full')}
          </div>
          ${this._giftStrip(pc.gifts)}
          <div class="cp-role-line"><span class="cp-role-kind">${pc.kind === 'coach' ? 'Тренер' : 'Гравець'}</span></div>
          <h1 class="cp-title cp-title-name">${sanitize(pc.name)}${this._giftStatusBadge(pc.gifts)}</h1>
          <div class="cp-role-badge" style="border-color:var(--pos-ring);color:var(--pos-ring)">${sanitize(pc.pos)}</div>
          <div class="cp-club-line cp-club-brand"><span class="cp-brand-a">Металіст</span> <span class="cp-brand-b">Штутгарт</span></div>
          <div class="cp-status"><span class="cp-dot"></span>Відвідуваність ${Math.round(pc.attPct)}% · тап по фото → FIFA</div>
        </div>` : this._noPlayerLink()}

      <div class="cp-pills player-quick">
        <button type="button" class="cp-pill cp-pill-primary" data-action="open-default-board">⚽ Дошка</button>
        <button type="button" class="cp-pill" data-view="tactics">📋 Схеми</button>
        <button type="button" class="cp-pill" data-view="trainings">📅 Тренування</button>
        <button type="button" class="cp-pill" data-view="players">👥 Склад</button>
        <button type="button" class="cp-pill" data-view="analytics">📊 Аналітика</button>
      </div>

      ${me ? this._myStatsCharts(me, stats) : ''}
      <!-- порівняння лише у FIFA-картці -->

      <div class="dg">
        <div class="sc"><div class="lb">Наступне тренування</div><div class="vl" style="font-size:13px">${next ? sanitize(next.name) : '—'}</div><div class="sb">${next ? next.date + ' ' + (next.time || '') : ''}</div></div>
        <div class="sc"><div class="lb">Наступний матч</div><div class="vl" style="font-size:13px">${nextMatch ? 'vs ' + sanitize(nextMatch.opponent) : '—'}</div><div class="sb">${nextMatch ? nextMatch.date : ''}</div></div>
      </div>

      <div class="card glass">
        <div class="ct">Останні тренування</div>
        <div class="player-tr-list">${pastTr.length ? pastTr.map(t => {
          const a = me && t.attendance && t.attendance[me.id];
          const present = a ? (a.present !== false) : null;
          const badge = present === true ? '✓' : (present === false ? '✗' : '—');
          const rpe = a && a.rpe != null ? ('RPE ' + a.rpe) : '';
          return `<div class="player-tr-row">
            <span class="ptr-badge">${badge}</span>
            <span class="ptr-name">${sanitize(t.name || 'Тренування')}</span>
            <span class="ptr-meta">${sanitize(t.date || '')} ${rpe}</span>
          </div>`;
        }).join('') : '<p class="note-sm">Немає даних. Імпортуйте JSON від тренера.</p>'}</div>
      </div>

      <div class="card glass">
        <div class="ct">Схеми</div>
        <div class="player-scheme-list">${schemes.length ? schemes.map(b =>
          `<button type="button" class="btn btn-s btn-sm" data-load-board="${b.id}" style="margin:4px">${sanitize(b.name || 'Схема')}</button>`
        ).join('') : '<span class="note-sm">Немає схем</span>'}
        <button type="button" class="btn btn-p btn-sm" data-action="open-default-board" style="margin:4px">Дошка</button>
        </div>
      </div>
      ${this._coachPublicCard()}
      `;
  },

  /** Публічна картка тренера — бачать усі (гравці/гості) */
  _coachPublicCard() {
    const s = Store.get();
    const set = s.settings || {};
    const name = set.coachName || 'Artem Serdiuk';
    const photo = set.coachPhoto || '';
    const cs = set.coachStats || { appMs: 0, boardMs: 0 };
    const todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
    const past = (s.trainings || []).filter(t => t.status === 'done' || ((t.date || '') < todayStr && t.status !== 'draft' && t.status !== 'cancelled'));
    let attP = 0, attT = 0;
    past.forEach(t => {
      Object.values(t.attendance || {}).forEach(a => {
        attT++;
        if (a && a.present !== false) attP++;
      });
    });
    const attPct = attT ? Math.round(attP / attT * 100) : 0;
    const appT = (typeof App !== 'undefined' && App.formatDurationMs) ? App.formatDurationMs(cs.appMs || 0) : '—';
    const boardT = (typeof App !== 'undefined' && App.formatDurationMs) ? App.formatDurationMs(cs.boardMs || 0) : '—';
    const ph = photo
      ? '<img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer"/>'
      : '<span class="cp-avatar-ph">AS</span>';
    return `
      <div class="card glass coach-public-card">
        <div class="ct">Головний тренер</div>
        <button type="button" class="coach-pub-row" data-action="coach-easter">
          <div class="coach-pub-av">${ph}</div>
          <div class="coach-pub-body">
            <div class="coach-pub-name">${sanitize(name)}</div>
            <div class="coach-pub-meta">Тренувань: ${past.length} · Відвідуваність команди ${attPct}%</div>
            <div class="coach-pub-meta">У додатку: ${appT} · На дошці: ${boardT}</div>
          </div>
          <span class="tg-row-chevron">›</span>
        </button>
        <p class="note-sm">Тап — золота картка тренера зі статистикою</p>
      </div>`;
  },

  _guestHome() {
    const s = Store.get();
    const set = s.settings || {};
    const social = set.social || {};
    const tg = social.telegram || social.channel || set.telegramChannel || 'https://t.me/';
    const ig = social.instagram || set.instagram || 'https://instagram.com/';
    const yt = social.youtube || set.youtube || 'https://youtube.com/';
    const media = Array.isArray(set.guestMedia) ? set.guestMedia : (Array.isArray(s.guestMedia) ? s.guestMedia : []);
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nextMatch = s.matches.filter(m => m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];

    return `
      <div class="guest-welcome">
        <div class="guest-hero-card glass">
          <div class="guest-logo">МШ</div>
          <h1 class="guest-h1">МЕТАЛІСТ ШТУТГАРТ</h1>
          <p class="guest-tag">Офіційний простір клубу</p>
          <p class="note-sm">Ви увійшли як <strong>гість</strong>. Повний функціонал — для гравців складу та тренера.</p>
          <button type="button" class="btn btn-p" data-io="import" data-action="import-trigger" style="width:100%;min-height:48px;margin-top:12px">📥 Імпорт JSON від тренера</button>
        </div>

        <div class="guest-social">
          <a class="guest-soc-btn" href="${sanitize(tg)}" target="_blank" rel="noopener">✈️ Telegram</a>
          <a class="guest-soc-btn" href="${sanitize(ig)}" target="_blank" rel="noopener">📸 Instagram</a>
          <a class="guest-soc-btn" href="${sanitize(yt)}" target="_blank" rel="noopener">▶ YouTube</a>
        </div>

        <div class="dg">
          <div class="sc"><div class="lb">Наступне тренування</div><div class="vl" style="font-size:13px">${next ? sanitize(next.name) : '—'}</div><div class="sb">${next ? next.date : ''}</div></div>
          <div class="sc"><div class="lb">Наступний матч</div><div class="vl" style="font-size:13px">${nextMatch ? 'vs ' + sanitize(nextMatch.opponent) : '—'}</div><div class="sb">${nextMatch ? nextMatch.date : ''}</div></div>
          <div class="sc"><div class="lb">Гравців у складі</div><div class="vl">${(s.players||[]).length}</div></div>
        </div>

        <div class="card glass">
          <div class="ct">Медіа клубу</div>
          ${media.length ? `<div class="guest-media-grid">${media.map(m => {
            const url = typeof m === 'string' ? m : (m.url || m.src || '');
            const title = typeof m === 'object' ? (m.title || '') : '';
            if (!url) return '';
            if (/\\.(mp4|webm|mov)(\\?|$)/i.test(url) || (m && m.type === 'video')) {
              return `<div class="guest-media-item"><video src="${sanitize(url)}" controls playsinline></video>${title ? `<div class="gm-cap">${sanitize(title)}</div>` : ''}</div>`;
            }
            return `<div class="guest-media-item"><img src="${sanitize(url)}" alt="" loading="lazy"/>${title ? `<div class="gm-cap">${sanitize(title)}</div>` : ''}</div>`;
          }).join('')}</div>` : '<p class="note-sm">Тренер ще не додав медіа. Після імпорту JSON тут з’являться матеріали.</p>'}
        </div>
      </div>`;
  },

  trainings() {
    const s = Store.get();
    const canEdit = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const todayStr = (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
    let list = (s.trainings || []).slice();
    // Гравці / гості: без чернеток; лише planned/done/cancelled (+ майбутні та минулі)
    if (!canEdit) {
      list = list.filter(t => {
        const st = t.status || 'planned';
        return st !== 'draft' && st !== 'pinned';
      });
    }
    list.sort((a, b) => {
      // upcoming first, then past by date desc
      const ad = a.date || '';
      const bd = b.date || '';
      const aUp = ad >= todayStr ? 0 : 1;
      const bUp = bd >= todayStr ? 0 : 1;
      if (aUp !== bUp) return aUp - bUp;
      return aUp === 0 ? ad.localeCompare(bd) : bd.localeCompare(ad);
    });
    return `
      <div class="st">Тренування ${canEdit ? '<button class="btn btn-p btn-sm" data-action="new-training">+ Нове</button>' : '<span class="note-sm">заплановані та минулі</span>'}</div>
      <div class="fb">
        <input type="search" id="trSearch" placeholder="Пошук..." data-filter="trainings">
        <select id="trStatus" data-filter="trainings">
          <option value="">Всі статуси</option>
          ${canEdit ? '<option value="draft">Чернетка</option>' : ''}
          <option value="planned">Заплановане</option>
          <option value="done">Проведено</option>
          ${canEdit ? '<option value="pinned">Закріплене</option>' : ''}
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
      const isDone = t.status === 'done';
      const isPlanned = t.status === 'planned' || (!t.status && !cancelled);
      const statusCls = cancelled ? ' is-cancelled' : (isDone ? ' is-done' : (isPlanned ? ' is-planned' : ''));
      return `<div class="tg-row card-training${statusCls}"
          data-training-id="${t.id}"
          data-tr-status="${sanitize(t.status || '')}"
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


  /** Тренер відкриває картку гравця так, як її бачить сам гравець + інструменти */
  coachPlayerDetail(playerId) {
    const s = Store.get();
    const p = (s.players || []).find(x => x.id === playerId);
    if (!p) return '<div class="es">Гравець не знайдений</div>';
    const st = this._playerStats ? this._playerStats(p.id) : {};
    const fifa = this._fifaCard(p, st);
    const compare = ''; /* порівняння всередині FIFA */
    let giftsHtml = '';
    try {
      const all = (typeof CoachTools !== 'undefined' && CoachTools.playerGifts) ? CoachTools.playerGifts(p.id) : [];
      if (all.length) {
        giftsHtml = '<div class="cpv-section"><div class="cpv-title">Артефакти</div><div class="gift-row">' +
          all.map(g => '<span class="gift-chip' + (g.attached ? ' attached' : '') + '" title="' + sanitize(g.note || g.label) + '"><span class="gift-ico">' + (g.ico || '★') + '</span>' + sanitize(g.label) + (g.attached ? ' · на профілі' : '') + '</span>').join('') +
          '</div></div>';
      }
    } catch (_) {}
    let momentsHtml = '';
    try {
      const moms = (typeof CoachTools !== 'undefined' && CoachTools.playerMoments) ? CoachTools.playerMoments(p.id) : [];
      if (moms.length) {
        momentsHtml = '<div class="cpv-section"><div class="cpv-title">Памʼятні моменти</div>' +
          moms.slice(0, 8).map(m => '<div class="moment-card"><div class="moment-date">' + sanitize((m.createdAt || '').slice(0, 10)) + '</div><div class="moment-text">' + sanitize(m.text) + '</div></div>').join('') +
          '</div>';
      }
    } catch (_) {}
    const charts = this._myStatsCharts ? this._myStatsCharts(p, st) : '';
    const catalog = (typeof CoachTools !== 'undefined' && CoachTools.GIFT_CATALOG) ? CoachTools.GIFT_CATALOG : [];
    const award = `
      <div class="cpv-section">
        <div class="cpv-title">Нагородити подарунком</div>
        <div class="gift-award-grid">
          ${catalog.map(g => { const rar = g.rarity || 'common'; const rl = (CoachTools.RARITY_LABEL && CoachTools.RARITY_LABEL[rar]) || rar; return '<button type="button" class="gift-award-btn rarity-' + rar + '" data-action="award-gift" data-player-id="' + p.id + '" data-gift-id="' + g.id + '" style="--art-hue:' + (g.hue||42) + '"><span class="ico">' + g.ico + '</span><span class="gift-aw-lab">' + sanitize(g.label) + '</span><small class="gift-aw-rar">' + sanitize(rl) + '</small></button>'; }).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <p class="note-sm" style="margin:8px 0 0">Памʼятний підпис додається лише разом із подарунком (кнопки вище).</p>
          <button type="button" class="btn-s" data-action="edit-player-form" data-player-id="${p.id}">Редагувати анкету</button>
        </div>
      </div>`;
    return `<div class="coach-player-view">
      ${fifa}
      ${compare}
      ${charts}
      ${giftsHtml}
      ${momentsHtml}
      ${award}
    </div>`;
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
      const g = String(p.group || p.squadRole || p.role || '').toLowerCase();
      if (g === 'reserve' || g === 'bench' || g === 'reserves') return false;
      if (g === 'main' || g === 'starter' || g === 'first' || g === 'basis') return true;
      if (p.isStarter === true) return true;
      if (p.isStarter === false || p.onBench) return false;
      // injured → not counted as active starter label priority
      if (p.status === 'injured' || p.status === 'rehab' || p.status === 'recovery') return false;
      return true; // default basis unless marked reserve
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
      const isMe = (typeof AuthManager !== 'undefined' && AuthManager.isLinkedPlayer && AuthManager.isLinkedPlayer(p))
        || (typeof AuthManager !== 'undefined' && AuthManager.matchesPlayer && AuthManager.matchesPlayer(p));
      return `<div class="pl-row tg-row${inj ? ' is-injured' : ''}${!isStarter(p) ? ' is-reserve' : ''}${isMe ? ' is-me' : ''}"
        data-player-id="${p.id}" data-player-row="${p.id}" data-action="open-player-card">
        <span class="pl-num">#${p.number || '—'}</span>
        <span class="pl-name">${sanitize(p.lastName || '')} ${sanitize((p.firstName || '')[0] || '')}.</span>
        <span class="pl-pos">${sanitize(p.position || '')}</span>
        <span class="pl-att">${att}%</span>
        <span class="pl-role">${role}</span>
      </div>`;
    }).join('');

    const isCoach = typeof AuthManager !== 'undefined' && AuthManager.isCoach && AuthManager.isCoach();
    const compareBlock = ''; /* порівняння лише у FIFA */

    // Для гравців / гостей — картки профілів (як на головній), без редагування
    if (!isCoach) {
      const cards = list.map(p => {
        const photo = this._resolvePlayerAvatar ? this._resolvePlayerAvatar(p) : (p.photoUrl || '');
        const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || ('#' + (p.number || ''));
        const att = attPct(p.id);
        const role = roleLabel(p);
        const acc = this._posAccent ? this._posAccent(p.position) : { bg: '#1a3a5c', ring: '#c8a84b' };
        const initials = this._initials ? this._initials(name) : '??';
        const ph = photo
          ? '<img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"/>'
          : '<span class="cp-avatar-ph">' + sanitize(initials) + '</span>';
        const isMe = (typeof AuthManager !== 'undefined' && AuthManager.isLinkedPlayer && AuthManager.isLinkedPlayer(p))
          || (typeof AuthManager !== 'undefined' && AuthManager.matchesPlayer && AuthManager.matchesPlayer(p));
        let gifs = [];
        try {
          if (typeof CoachTools !== 'undefined' && CoachTools.playerGifts)
            gifs = (CoachTools.playerGifts(p.id) || []).filter(g => g.attached !== false).slice(0, 3);
        } catch (_) {}
        const giftOrbit = this._tgGiftCloud(gifs, 0.85, 'mini3');
        const giftBadge = this._giftStatusBadge(gifs);
        return '<div class="pl-card glass' + (isMe ? ' is-me' : '') + '" data-player-id="' + p.id + '" data-action="open-player-card" role="button" tabindex="0">' +
          '<div class="pl-card-av-wrap"><div class="pl-card-av" style="border-color:' + acc.ring + ';background:' + acc.bg + '">' + ph + '</div>' + giftOrbit + '</div>' +
          '<div class="pl-card-body">' +
          '<div class="pl-card-name">#' + (p.number || '—') + ' ' + sanitize(name) + ' ' + this._giftStatusBadge(gifs, p.id) + '</div>' +
          '<div class="pl-card-meta">' + sanitize(p.position || '') + ' · ' + role + '</div>' +
          '<div class="pl-card-att">Відвідуваність ' + att + '%</div>' +
          '</div></div>';
      }).join('');
      return `
      <div class="st">Склад <span class="note-sm">перегляд · порівняння</span></div>
      ${compareBlock}
      <div class="pl-cards">${this._coachSquadCard()}${cards || '<div class="es">Немає гравців</div>'}</div>`;
    }

    const viewMode = (typeof window !== 'undefined' && window.__squadViewMode) || 'list';
    const cardsCoach = list.map(p => {
      const photo = this._resolvePlayerAvatar ? this._resolvePlayerAvatar(p) : (p.photoUrl || '');
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || ('#' + (p.number || ''));
      const att = attPct(p.id);
      const role = roleLabel(p);
      const acc = this._posAccent ? this._posAccent(p.position) : { bg: '#1a3a5c', ring: '#c8a84b' };
      const initials = this._initials ? this._initials(name) : '??';
      const ph = photo
        ? '<img src="' + sanitize(photo) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'"/>'
        : '<span class="cp-avatar-ph">' + sanitize(initials) + '</span>';
      let gifs = [];
      try {
        if (typeof CoachTools !== 'undefined' && CoachTools.playerGifts)
          gifs = (CoachTools.playerGifts(p.id) || []).filter(g => g.attached !== false).slice(0, 3);
      } catch (_) {}
      const giftOrbit = this._tgGiftCloud(gifs, 0.85, 'mini3');
      return '<div class="pl-card glass" data-player-id="' + p.id + '" data-action="open-player-card" role="button" tabindex="0">' +
        '<div class="pl-card-av-wrap"><div class="pl-card-av" style="border-color:' + acc.ring + ';background:' + acc.bg + '">' + ph + '</div>' + giftOrbit + '</div>' +
        '<div class="pl-card-body">' +
        '<div class="pl-card-name">#' + (p.number || '—') + ' ' + sanitize(name) + ' ' + this._giftStatusBadge(gifs, p.id) + '</div>' +
        '<div class="pl-card-meta">' + sanitize(p.position || '') + ' · ' + role + '</div>' +
        '<div class="pl-card-att">Відвідуваність ' + att + '%</div></div></div>';
    }).join('');

    // coach stats strip
    const coachStats = (s.coachStats || {});
    const appH = coachStats.appMs ? Math.round(coachStats.appMs / 3600000 * 10) / 10 : 0;
    const boardH = coachStats.boardMs ? Math.round(coachStats.boardMs / 3600000 * 10) / 10 : 0;
    const trN = (s.trainings || []).length;
    const doneN = (s.trainings || []).filter(t => t.status === 'done').length;

    return `
      <div class="st">Склад
        <span class="squad-view-toggle">
          <button type="button" class="btn-s${viewMode==='list'?' on':''}" data-action="squad-view" data-mode="list">Список</button>
          <button type="button" class="btn-s${viewMode==='cards'?' on':''}" data-action="squad-view" data-mode="cards">Картки</button>
        </span>
        <button class="btn btn-p btn-sm" data-action="new-player">+ Гравець</button>
      </div>
      ${(() => {
        const ach = (typeof CoachTools !== 'undefined' && CoachTools.getCoachAchievements)
          ? CoachTools.getCoachAchievements() : null;
        const appLabel = ach ? (ach.appMs >= 3600000 ? ((Math.round(ach.appMs/360000)/10) + ' г') : (Math.round(ach.appMs/60000) + ' хв')) : (appH + ' год');
        const boardLabel = ach ? (ach.boardMs >= 3600000 ? ((Math.round(ach.boardMs/360000)/10) + ' г') : (Math.round(ach.boardMs/60000) + ' хв')) : (boardH + ' год');
        const attC = ach ? ach.attendancePct : 0;
        const giftsN = ach ? ach.giftsGiven : 0;
        return '<div class="coach-stats-strip glass">' +
          '<div class="css-item"><b>' + trN + '</b><span>Тренувань</span></div>' +
          '<div class="css-item"><b>' + doneN + '</b><span>Проведено</span></div>' +
          '<div class="css-item"><b>' + appLabel + '</b><span>У додатку</span></div>' +
          '<div class="css-item"><b>' + boardLabel + '</b><span>На дошці</span></div>' +
          '<div class="css-item"><b>' + attC + '%</b><span>Відвід. тренера</span></div>' +
          '<div class="css-item"><b>' + giftsN + '</b><span>Подарунків</span></div>' +
          '</div>';
      })()}
      <p class="note-sm">Тап — картка. Утримуйте — меню. Картки / список — перемикач вище.</p>
      ${compareBlock}
      ${viewMode === 'cards'
        ? ('<div class="pl-cards">' + this._coachSquadCard() + (cardsCoach || '<div class="es">Немає гравців</div>') + '</div>')
        : (`<div class="pl-table glass">
        <div class="pl-head">
          ${th('number', '№')}
          ${th('name', 'Прізвище')}
          ${th('pos', 'Поз.')}
          ${th('att', 'Відв.%')}
          ${th('role', 'Склад')}
        </div>
        <div class="pl-body">${rows || '<div class="es">Немає гравців</div>'}</div>
      </div>`)}`;
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
      </div>
      <div class="card glass"><div class="ct">Статистика гравців (як у кабінеті гравця)</div>
        <div class="pl-stats-table">
          <div class="pl-stats-head"><span>Гравець</span><span>Поз.</span><span>Група</span><span>Відв.%</span><span>RPE</span><span>Load28</span></div>
          ${s.players.slice().sort((a,b)=>String(a.lastName||'').localeCompare(String(b.lastName||''),'uk')).map(p => {
            const st = this._playerStats(p.id);
            const g = (p.group === 'reserve') ? 'Резерв' : 'Основа';
            return `<div class="pl-stats-row">
              <span>#${p.number||'—'} ${sanitize(p.lastName||'')}</span>
              <span>${sanitize(p.position||'—')}</span>
              <span>${g}</span>
              <span>${st.attPct!=null?st.attPct:'—'}%</span>
              <span>${st.avgRpe!=null?st.avgRpe:'—'}</span>
              <span>${st.load28!=null?st.load28:'—'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card glass"><div class="ct">Дні народження (найближчі)</div>
        ${(() => {
          const list = (s.players||[]).filter(p => p.birthDate).map(p => {
            const d = String(p.birthDate).slice(5,10); // MM-DD
            return { p, md: d };
          }).sort((a,b)=>a.md.localeCompare(b.md));
          if (!list.length) return '<p class="note-sm">Додайте дату народження в анкеті гравця.</p>';
          return list.map(({p,md}) => `<div class="bday-row">🎂 ${md} — #${p.number||''} ${sanitize(p.lastName||'')} ${sanitize(p.firstName||'')}</div>`).join('');
        })()}
      </div>
`;
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
      const logoHtml = s.logoData
        ? ('<img src="' + s.logoData + '" style="width:100%;height:100%;object-fit:cover"/>')
        : sanitize(s.clubShort || 'МШ');
      const coachHtml = s.coachPhoto
        ? ('<img src="' + s.coachPhoto + '" style="width:100%;height:100%;object-fit:cover"/>')
        : 'АС';
      return `
      <div class="st">Налаштування</div>

      <div class="card glass">
        <div class="ct">Фото та логотип</div>
        <div class="settings-photo-row" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:center">
          <div style="text-align:center">
            <div class="logo-ph" style="width:72px;height:72px;border-radius:50%;margin:0 auto 8px;overflow:hidden;background:#1a3a5c;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff">${logoHtml}</div>
            <button type="button" class="btn btn-s" data-action="upload-club-logo">📷 Логотип клубу</button>
          </div>
          <div style="text-align:center">
            <div class="logo-ph" style="width:72px;height:72px;border-radius:50%;margin:0 auto 8px;overflow:hidden;background:linear-gradient(145deg,#f1c40f,#e67e22);display:flex;align-items:center;justify-content:center;font-weight:800;color:#1a1a1a">${coachHtml}</div>
            <button type="button" class="btn btn-s" data-action="upload-coach-photo">📷 Фото тренера</button>
          </div>
        </div>
        <p class="note-sm" style="margin-top:8px">Фото тренера — на головній картці. Логотип — в емблемі шапки.</p>
        <input type="file" id="settingsLogoInput" accept="image/*" hidden/>
        <input type="file" id="settingsCoachPhotoInput" accept="image/*" hidden/>
      </div>

      <div class="card glass coach-tools-settings">
        <div class="ct">Telegram · інструменти тренера</div>
        <p class="note-sm">Синхронізація Cloud Storage та шеринг у чат команди.</p>
        <div class="coach-tools-grid" style="display:flex;flex-wrap:wrap;gap:8px">
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="sync-push">☁ Зберегти в Cloud</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="sync-pull">☁ Завантажити з Cloud</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="share-training">📤 План у чат</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="share-roster">👥 Склад у чат</button>
        </div>
        <p class="note-sm" id="tgStatusLine" style="margin-top:8px"></p>
      </div>

      <div class="card glass">
        <div class="ct">Клуб</div>
        <div class="fgr"><label>Назва клубу</label><input id="setClubName" value="${sanitize(s.clubName || '')}"/></div>
        <div class="fgr"><label>Скорочення</label><input id="setClubShort" value="${sanitize(s.clubShort || '')}"/></div>
        <div class="fgr"><label>Імʼя тренера</label><input id="setCoachName" value="${sanitize(s.coachName || 'Artem Serdiuk')}"/></div>
        <div class="fgr full"><label>Фото тренера (URL або файл)</label>
          <input id="setCoachPhoto" type="url" placeholder="https://… або файл нижче" value="${(s.coachPhoto||'').indexOf('data:')===0 ? '' : sanitize(s.coachPhoto || '')}"/>
          <input id="setCoachPhotoFile" type="file" accept="image/*" style="margin-top:6px;font-size:12px"/>
          ${s.coachPhoto ? '<img src="'+sanitize(s.coachPhoto)+'" alt="" style="max-height:64px;margin-top:6px;border-radius:8px">' : ''}
        </div>
        <div class="fgr"><label>Колір основний</label><input id="setPrimary" type="color" value="${pri}"/></div>
        <div class="fgr"><label>Колір акцент</label><input id="setAccent" type="color" value="${acc}"/></div>
        <div class="fgr"><label>Тема</label>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn btn-s" data-action="toggle-theme" data-theme-set="dark">🌙 Темна</button>
            <button type="button" class="btn btn-s" data-action="toggle-theme" data-theme-set="light">☀️ Світла</button>
          </div>
        </div>
        <button type="button" class="btn btn-p" data-action="save-settings" style="margin-top:10px">Зберегти</button>
      </div>

      <div class="card glass data-io">
        <div class="ct">Дані</div>
        <div class="data-io glass-io" style="display:flex;flex-wrap:wrap;gap:8px">
          <button type="button" class="btn btn-p data-io-btn coach-only" data-io="export" data-action="export">Експорт JSON</button>
          <button type="button" class="btn btn-s data-io-btn" data-io="import" data-action="import-trigger">Імпорт JSON</button>
        </div>
        <p class="note-sm">Імпорт доступний усім. Експорт — лише тренеру.</p>
      </div>

      <div class="card glass coach-only">
        <div class="ct">Артефакти клубу (NFT)</div>
        <p class="note-sm">Встав JSON з Gemini (короткий опис → промпт → JSON) і додай у каталог нагород.</p>
        <div class="fgr full">
          <label>JSON артефакту</label>
          <textarea id="artifactJsonInput" rows="6" placeholder='{ "id": "welcome_club_badge", "ico": "🔰", "label": "...", "rarity": "common", "hue": 200, "pattern": 1, "description": "...", "momentHint": "..." }'></textarea>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          <button type="button" class="btn btn-p" data-action="add-artifact-json">Додати артефакт у каталог</button>
          <button type="button" class="btn btn-s" data-action="preview-artifacts">Каталог (${(typeof CoachTools !== 'undefined' && CoachTools.GIFT_CATALOG) ? CoachTools.GIFT_CATALOG.length : 0})</button>
          <button type="button" class="btn btn-s" data-action="create-emoji-artifact">+ Emoji-артефакт</button>
        </div>
        <p class="note-sm" style="margin-top:8px">Після додавання артефакт з’явиться в картці гравця → «Нагородити».</p>
      </div>

      <div class="card"><div class="ct">Про застосунок</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.6">
          Тренерська платформа · МЕТАЛІСТ ШТУТГАРТ<br>
          Schema v${typeof SCHEMA_VERSION !== 'undefined' ? SCHEMA_VERSION : 2} · build 2026.10.27-c<br>
          localStorage · Telegram Cloud
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
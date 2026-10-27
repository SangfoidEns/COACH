/** Інструменти тренера + швидкі дії з Telegram */
const CoachTools = {
  /** Текст наступного тренування для шерингу в чат */
  formatNextTrainingMessage() {
    const s = Store.get();
    const today = (typeof LoadModel !== 'undefined' && LoadModel.todayStr)
      ? LoadModel.todayStr()
      : new Date().toISOString().slice(0, 10);
    const next = (s.trainings || [])
      .filter(t => t.status === 'planned' && t.date >= today)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
    if (!next) return 'Немає запланованих тренувань.';
    const blocks = (next.structure || [])
      .map(b => '• ' + (b.title || b.name || 'Блок') + ' — ' + (b.duration || 0) + ' хв')
      .join('\n');
    const club = (s.settings && s.settings.clubName) || 'МЕТАЛІСТ ШТУТГАРТ';
    return (
      '⚽ ' + club + '\n' +
      '📋 ' + (next.name || 'Тренування') + '\n' +
      '📅 ' + next.date + (next.time ? ' · ' + next.time : '') + '\n' +
      '⏱ ' + (next.duration || 0) + ' хв · RPE ' + (next.intensity || '—') + '\n' +
      (next.mainGoal ? '🎯 ' + next.mainGoal + '\n' : '') +
      (blocks ? '\nСтруктура:\n' + blocks : '')
    );
  },

  formatRosterSummary() {
    const s = Store.get();
    const avail = (s.players || []).filter(p => !p.status || p.status === 'available' || p.status === 'healthy');
    const inj = (s.players || []).filter(p => p.status === 'injured' || p.status === 'rehab' || p.status === 'recovery');
    const lines = avail
      .slice()
      .sort((a, b) => (a.number || 0) - (b.number || 0))
      .map(p => '#' + (p.number || '—') + ' ' + (p.lastName || p.firstName || '') + ' (' + (p.position || '') + ')')
      .join('\n');
    return (
      '👥 Склад у строю: ' + avail.length + '\n' +
      '🩹 Травма/відновлення: ' + inj.length + '\n\n' +
      (lines || 'Немає гравців')
    );
  },

  async shareNextTraining() {
    const text = this.formatNextTrainingMessage();
    const ok = await TelegramManager.shareText('Тренування · МЕТАЛІСТ ШТУТГАРТ', text);
    if (!ok && typeof Toast !== 'undefined') Toast.show('Не вдалося поділитися — скопіюйте з буфера', 'warn');
    return ok;
  },

  async shareRoster() {
    const text = this.formatRosterSummary();
    return TelegramManager.shareText('Склад · МЕТАЛІСТ ШТУТГАРТ', text);
  },

  async syncCloudNow() {
    try {
      if (typeof StorageManager === 'undefined') return false;
      await TelegramManager.requestWriteAccess();
      if (StorageManager.pushToCloud) {
        StorageManager.pushToCloud();
        try { TelegramManager.hapticSuccess(); } catch (_) {}
        if (typeof Toast !== 'undefined') Toast.show('Синхронізація з Telegram Cloud…', 'ok');
        return true;
      }
    } catch (e) {
      console.warn('[CoachTools] sync', e);
      try { TelegramManager.hapticError(); } catch (_) {}
      if (typeof Toast !== 'undefined') Toast.show('Помилка синхронізації', 'error');
    }
    return false;
  },

  async pullCloudNow() {
    try {
      if (!StorageManager.pullFromCloud) return null;
      const data = await StorageManager.pullFromCloud();
      if (data) {
        try { TelegramManager.hapticSuccess(); } catch (_) {}
        if (typeof Toast !== 'undefined') Toast.show('Дані з хмари завантажено', 'ok');
        if (typeof App !== 'undefined' && App.renderCurrent) App.renderCurrent();
      } else if (typeof Toast !== 'undefined') {
        Toast.show('У хмарі немає новіших даних', 'warn');
      }
      return data;
    } catch (e) {
      console.warn('[CoachTools] pull', e);
      return null;
    }
  },

  /** Швидкий старт сесії: відкрити відвідування найближчого planned на сьогодні/майбутнє */
  openTodayAttendance() {
    const s = Store.get();
    const today = (typeof LoadModel !== 'undefined' && LoadModel.todayStr)
      ? LoadModel.todayStr()
      : new Date().toISOString().slice(0, 10);
    let t = (s.trainings || []).find(x => x.date === today && (x.status === 'planned' || x.status === 'done'));
    if (!t) {
      t = (s.trainings || [])
        .filter(x => x.status === 'planned' && x.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
    }
    if (!t) {
      if (typeof Toast !== 'undefined') Toast.show('Немає тренування для відміток', 'warn');
      return;
    }
    if (typeof Actions !== 'undefined' && Actions.openAttendance) {
      Actions.openAttendance(t.id);
      try { TelegramManager.haptic('medium'); } catch (_) {}
    }
  },

  startSessionTimers() {
    try {
      if (typeof TimerEngine !== 'undefined' && TimerEngine.startSession) {
        TimerEngine.startSession();
      } else {
        // fallback: клік по play у шапці
        document.querySelector('[data-action="timer-play"], [data-timer="play"]')?.click();
      }
      try { TelegramManager.haptic('medium'); } catch (_) {}
      if (typeof Toast !== 'undefined') Toast.show('Сесію запущено', 'ok');
    } catch (e) {
      console.warn(e);
    }
  },

  async exportAndShare() {
    try {
      if (typeof StorageManager !== 'undefined' && StorageManager.exportJSON) {
        await StorageManager.exportJSON();
        try { TelegramManager.hapticSuccess(); } catch (_) {}
      }
    } catch (e) {
      console.warn('[CoachTools] export', e);
    }
  },

  /** Панель інструментів тренера (HTML) */
  panelHtml() {
    const tg = typeof TelegramManager !== 'undefined' && TelegramManager.isTelegram;
    const platform = tg ? TelegramManager.platform() : 'browser';
    return `
      <div class="card glass coach-tools-panel">
        <div class="ct">Інструменти тренера</div>
        <p class="note-sm">Швидкі дії для сесії, складу та Telegram (${sanitize(platform)}).</p>
        <div class="coach-tools-grid">
          <button type="button" class="btn btn-p coach-tool" data-coach-tool="attendance">✓ Відвідування сьогодні</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="share-training">📤 План тренування в чат</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="share-roster">👥 Склад у чат</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="timer">▶ Старт сесії</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="sync-push">☁ Зберегти в Telegram Cloud</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="sync-pull">☁ Завантажити з Cloud</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="export">📦 Експорт / Share JSON</button>
          <button type="button" class="btn btn-s coach-tool" data-coach-tool="board">⛶ Тактична дошка</button>
        </div>
      </div>`;
  },

  handleAction(tool) {
    switch (tool) {
      case 'attendance': return this.openTodayAttendance();
      case 'share-training': return this.shareNextTraining();
      case 'share-roster': return this.shareRoster();
      case 'timer': return this.startSessionTimers();
      case 'sync-push': return this.syncCloudNow();
      case 'sync-pull': return this.pullCloudNow();
      case 'export': return this.exportAndShare();
      case 'board':
        try {
          if (typeof App !== 'undefined') {
            App.allowBoardOnce && App.allowBoardOnce('coach-tools');
            App.navigate('board');
          }
        } catch (_) {}
        return;
      default:
        return;
    }
  }
};

if (typeof window !== 'undefined') window.CoachTools = CoachTools;


/** ── Telegram-style gifts & memorable moments ── */
/** NFT-артефакти клубу (як Telegram Gifts) — унікальні серійні екземпляри */
CoachTools.GIFT_CATALOG = [
  /* ── Telegram-style animated emoji artifacts ── */
  { id: 'star_gold',   ico: '⭐', label: 'Золота зірка',     rarity: 'legendary', hue: 42,  pattern: 1, anim: 'sparkle' },
  { id: 'cup_silver',  ico: '🏆', label: 'Срібний кубок',    rarity: 'epic',      hue: 210, pattern: 2, anim: 'bounce' },
  { id: 'fire_core',   ico: '🔥', label: 'Ядро вогню',       rarity: 'rare',      hue: 14,  pattern: 3, anim: 'pulse' },
  { id: 'bolt_neon',   ico: '⚡', label: 'Неонова енергія',  rarity: 'rare',      hue: 55,  pattern: 4, anim: 'flash' },
  { id: 'heart_club',  ico: '❤️', label: 'Серце Металіста',  rarity: 'common',    hue: 350, pattern: 5, anim: 'heartbeat' },
  { id: 'medal_train', ico: '🏅', label: 'Медаль тренування',rarity: 'common',    hue: 38,  pattern: 6, anim: 'sway' },
  { id: 'ball_pro',    ico: '⚽', label: 'Pro-мʼяч',         rarity: 'epic',      hue: 120, pattern: 7, anim: 'spin' },
  { id: 'crown_coach', ico: '👑', label: 'Корона тренера',   rarity: 'legendary', hue: 48,  pattern: 8, anim: 'sparkle' },
  { id: 'boot_speed',  ico: '👟', label: 'Швидкі бутси',     rarity: 'rare',      hue: 280, pattern: 9, anim: 'bounce' },
  { id: 'glove_gk',    ico: '🧤', label: 'Рукавиці GK',      rarity: 'epic',      hue: 160, pattern: 10, anim: 'wiggle' },
  { id: 'whistle',     ico: '📢', label: 'Свисток лідера',   rarity: 'common',    hue: 200, pattern: 11, anim: 'pulse' },
  { id: 'shield',      ico: '🛡️', label: 'Щит оборони',      rarity: 'rare',      hue: 195, pattern: 12, anim: 'sway' },
  /* сучасні emoji-набори клубу */
  { id: 'rocket_form', ico: '🚀', label: 'Форма ракети',     rarity: 'epic',      hue: 200, pattern: 3, anim: 'launch',
    description: 'За вибуховий прогрес у сезоні.', momentHint: 'Вгору тільки вгору!' },
  { id: 'target_focus', ico: '🎯', label: 'Точний удар',      rarity: 'rare',      hue: 0,   pattern: 5, anim: 'pulse',
    description: 'За концентрацію і виконання завдань на тренуванні.' },
  { id: 'gem_metality', ico: '💎', label: 'Діамант Металіста', rarity: 'legendary', hue: 190, pattern: 8, anim: 'sparkle',
    description: 'Рідкісний артефакт за видатний внесок у клуб.' },
  { id: 'fox_smart',   ico: '🦊', label: 'Хитрий лис',       rarity: 'rare',      hue: 25,  pattern: 4, anim: 'wiggle',
    description: 'За розумну гру і тактичну кмітливість.' },
  { id: 'lion_heart',  ico: '🦁', label: 'Лев Штутгарта',    rarity: 'epic',      hue: 40,  pattern: 6, anim: 'roar',
    description: 'За лідерство і характер на полі.' },
  { id: 'dragon_power', ico: '🐉', label: 'Дракон сили',     rarity: 'legendary', hue: 320, pattern: 9, anim: 'pulse',
    description: 'Максимальна інтенсивність і бойовий дух.' },
  { id: 'sparkles_mvp', ico: '✨', label: 'MVP-іскра',        rarity: 'epic',      hue: 50,  pattern: 2, anim: 'sparkle',
    description: 'Гравець матчу / тренування.' },
  { id: 'camera_moment', ico: '📸', label: 'Кадр сезону',    rarity: 'rare',      hue: 210, pattern: 7, anim: 'flash',
    description: 'Пам\'ятний момент з фото або відео тренування.', momentHint: 'Збережи цей кадр назавжди.' },
  { id: 'idea_light',  ico: '💡', label: 'Ідея тренера',     rarity: 'rare',      hue: 50,  pattern: 3, anim: 'flash',
    description: 'За ідею, пропозицію або креативне рішення для клубу.' },
  { id: 'clutch_100',  ico: '💯', label: 'На всі 100',       rarity: 'epic',      hue: 140, pattern: 1, anim: 'bounce',
    description: 'Повне виконання плану тренування.' },
  { id: 'welcome_club_badge', ico: '🔰', label: 'Священна Гільза Клубу', rarity: 'common', hue: 200, pattern: 1, anim: 'sway',
    description: 'Тренер дарує цей артефакт кожному новобранцю як знак офіційного приєднання до нашої футбольної родини.',
    momentHint: 'Вітаємо в клубі! Перший крок у великій історії Metalist Stuttgart!' },
  { id: 'neural_horse_tester', ico: '🧠', label: 'Нейронний Ударник Штутгарта',
    rarity: 'legendary', hue: 280, pattern: 11, anim: 'neural', special: 'neural-horse',
    description: 'Цей артефакт вручається за глибоке занурення в архітектуру додатку, виявлення критичних багів та візіонерські пропозиції, що формують майбутнє Metalist Stuttgart.',
    momentHint: 'Творець майбутнього: твій код — фундамент нашої перемоги!' },
  { id: 'tyshchenko_first_golden_ball', ico: '⚽', label: 'Золотий М\'яч Засновника',
    rarity: 'legendary', hue: 42, pattern: 12, anim: 'golden', special: 'golden-ball',
    description: 'Тренер та команда дарує цей артефакт президенту клубу та головному організатору за візіонерство, створення фундаменту та запуск історичного сезону Metalist Stuttgart.',
    momentHint: 'Перший Золотий М\'яч клубу 2025/2026: легендарний старт великої історії!' },
  { id: 'metalist_holo_emblem', ico: '✦', label: 'Голографічний Сигіл Металіста',
    rarity: 'legendary', hue: 185, pattern: 14, anim: 'hologram', special: 'metalist-holo-emblem',
    description: 'Ексклюзивний клубний сигіл Metalist Stuttgart: багатошаровий голографічний щит, сканувальні лінії та холодне фотонне світло. Створений спеціально для клубної платформи.',
    momentHint: 'CLUB SIGNAL · 001 — знак приналежності до майбутнього Metalist Stuttgart.' }
];


CoachTools.RARITY_LABEL = {
  common: 'Звичайний',
  rare: 'Рідкісний',
  epic: 'Епічний',
  legendary: 'Легендарний'
};

CoachTools._artifactSerial = function () {
  const n = Math.floor(Math.random() * 9000) + 1000;
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  return 'MS-' + t + '-' + n;
};

CoachTools._artifactSeed = function (str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};



/** Завантажити кастомні артефакти з settings у каталог (без дублікатів id) */
CoachTools.mergeCustomCatalog = function () {
  try {
    const s = Store.get();
    const extra = (s.settings && s.settings.customArtifacts) || [];
    if (!Array.isArray(extra) || !extra.length) return;
    const have = new Set((CoachTools.GIFT_CATALOG || []).map(g => g.id));
    extra.forEach(a => {
      if (!a || !a.id || have.has(a.id)) return;
      CoachTools.GIFT_CATALOG.push({
        id: String(a.id),
        ico: a.ico || '★',
        label: a.label || a.id,
        rarity: a.rarity || 'common',
        hue: a.hue != null ? Number(a.hue) : 42,
        pattern: a.pattern != null ? Number(a.pattern) : 0,
        description: a.description || '',
        momentHint: a.momentHint || ''
      });
      have.add(a.id);
    });
  } catch (e) { console.warn('[mergeCustomCatalog]', e); }
};

/**
 * Додати артефакт у каталог з JSON (Gemini / ручний ввід).
 * Зберігає в settings.customArtifacts і одразу в GIFT_CATALOG.
 */
CoachTools.addArtifactToCatalog = function (raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    // strip markdown fences if any
    const cleaned = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    obj = JSON.parse(cleaned);
  }
  if (!obj || typeof obj !== 'object') throw new Error('Невірний JSON артефакту');
  const id = String(obj.id || '').trim().replace(/\s+/g, '_');
  if (!id) throw new Error('Потрібен id');
  const rarity = ['common', 'rare', 'epic', 'legendary'].includes(obj.rarity) ? obj.rarity : 'common';
  const art = {
    id: id,
    ico: String(obj.ico || '★').slice(0, 4),
    label: String(obj.label || id).trim(),
    rarity: rarity,
    hue: Math.max(0, Math.min(360, Number(obj.hue) || 42)),
    pattern: Math.max(0, Math.min(12, Number(obj.pattern) || 0)),
    description: String(obj.description || '').trim(),
    momentHint: String(obj.momentHint || '').trim()
  };
  const s = Store.get();
  if (!s.settings) s.settings = {};
  if (!Array.isArray(s.settings.customArtifacts)) s.settings.customArtifacts = [];
  // upsert by id
  const ix = s.settings.customArtifacts.findIndex(x => x && x.id === art.id);
  if (ix >= 0) s.settings.customArtifacts[ix] = art;
  else s.settings.customArtifacts.push(art);
  // catalog upsert
  if (!CoachTools.GIFT_CATALOG) CoachTools.GIFT_CATALOG = [];
  const cix = CoachTools.GIFT_CATALOG.findIndex(x => x.id === art.id);
  if (cix >= 0) CoachTools.GIFT_CATALOG[cix] = Object.assign({}, CoachTools.GIFT_CATALOG[cix], art);
  else CoachTools.GIFT_CATALOG.push(art);
  try { StorageManager.save(); } catch (_) {}
  return art;
};


/** Створити сучасний анімований emoji-артефакт (Telegram-style) */
CoachTools.createEmojiArtifact = function (opts) {
  opts = opts || {};
  const ico = String(opts.ico || opts.emoji || '⭐').trim().slice(0, 8) || '⭐';
  const label = String(opts.label || 'Кастомний артефакт').trim().slice(0, 48) || 'Артефакт';
  const rarity = ['common', 'rare', 'epic', 'legendary'].includes(opts.rarity) ? opts.rarity : 'rare';
  const anim = opts.anim || 'bounce';
  const hue = Number.isFinite(+opts.hue) ? (+opts.hue % 360) : 42;
  const id = 'custom_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 999);
  const art = {
    id: id,
    ico: ico,
    label: label,
    rarity: rarity,
    hue: hue,
    pattern: Math.floor(Math.random() * 12),
    anim: anim,
    special: opts.special || null,
    mediaUrl: opts.mediaUrl || '',
    description: String(opts.description || '').slice(0, 280),
    momentHint: String(opts.momentHint || '').slice(0, 120)
  };
  if (!CoachTools.GIFT_CATALOG) CoachTools.GIFT_CATALOG = [];
  CoachTools.GIFT_CATALOG.push(art);
  try {
    const s = Store.get();
    if (!s.settings) s.settings = {};
    if (!Array.isArray(s.settings.customArtifacts)) s.settings.customArtifacts = [];
    s.settings.customArtifacts.push(art);
    if (typeof StorageManager !== 'undefined') StorageManager.save();
  } catch (_) {}
  if (typeof Toast !== 'undefined') Toast.show(ico + ' «' + label + '» додано в каталог', 'ok');
  return art;
};


CoachTools.loadCustomArtifacts = function () {
  try {
    const s = Store.get();
    const list = (s.settings && s.settings.customArtifacts) || [];
    if (!CoachTools.GIFT_CATALOG) CoachTools.GIFT_CATALOG = [];
    const have = new Set(CoachTools.GIFT_CATALOG.map(g => g.id));
    list.forEach(a => {
      if (a && a.id && !have.has(a.id)) {
        CoachTools.GIFT_CATALOG.push(a);
        have.add(a.id);
      }
    });
  } catch (_) {}
};

CoachTools.awardGift = function (playerId, giftId, note) {
  const s = Store.get();
  if (!s.gifts) s.gifts = [];
  const cat = (CoachTools.GIFT_CATALOG || []).find(g => g.id === giftId) || {
    id: giftId, ico: '★', label: giftId, rarity: 'common', hue: 45, pattern: 0
  };
  const serial = CoachTools._artifactSerial();
  const seed = CoachTools._artifactSeed(serial + playerId + Date.now());
  const hue = ((cat.hue != null ? cat.hue : 40) + (seed % 24) - 12 + 360) % 360;
  const gift = {
    id: (typeof uid === 'function' ? uid() : ('g_' + Date.now())),
    playerId,
    giftId: cat.id,
    ico: cat.ico,
    label: cat.label,
    note: note || '',
    attached: true,
    // NFT-поля
    serial: serial,
    rarity: cat.rarity || 'common',
    hue: hue,
    pattern: (cat.pattern != null ? cat.pattern : (seed % 12)),
    seed: seed,
    special: cat.special || null,
    anim: cat.anim || 'float',
    mediaUrl: cat.mediaUrl || '',
    description: cat.description || '',
    momentHint: cat.momentHint || '',
    createdAt: new Date().toISOString(),
    by: 'coach'
  };
  s.gifts.push(gift);
  try { StorageManager.save(); } catch (_) {}
  try { TelegramManager.hapticSuccess && TelegramManager.hapticSuccess(); } catch (_) {}
  const rar = (CoachTools.RARITY_LABEL && CoachTools.RARITY_LABEL[gift.rarity]) || gift.rarity;
  if (typeof Toast !== 'undefined') Toast.show(cat.ico + ' «' + cat.label + '» · ' + rar + ' · ' + serial, 'ok');
  try { if (typeof App !== 'undefined' && App.renderCurrent) App.renderCurrent(); } catch (_) {}
  return gift;
};

CoachTools.attachGift = function (giftId) {
  const s = Store.get();
  const g = (s.gifts || []).find(x => x.id === giftId);
  if (!g) return false;
  g.attached = true;
  try { StorageManager.save(); } catch (_) {}
  if (typeof Toast !== 'undefined') Toast.show('Подарунок прикріплено до профілю', 'ok');
  return true;
};

CoachTools.addMoment = function (playerId, text, trainingId) {
  const s = Store.get();
  if (!s.moments) s.moments = [];
  const m = {
    id: (typeof uid === 'function' ? uid() : ('m_' + Date.now())),
    playerId,
    trainingId: trainingId || null,
    text: String(text || '').trim(),
    createdAt: new Date().toISOString(),
    by: 'coach'
  };
  if (!m.text) return null;
  s.moments.push(m);
  try { StorageManager.save(); } catch (_) {}
  if (typeof Toast !== 'undefined') Toast.show('Памʼятний момент збережено', 'ok');
  return m;
};

CoachTools.setFeaturedGift = function (playerId, giftInstanceId) {
  const s = Store.get();
  if (!s.gifts) s.gifts = [];
  (s.gifts || []).forEach(g => {
    if (g.playerId === playerId) g.featured = (g.id === giftInstanceId);
  });
  try { StorageManager.save(); } catch (_) {}
  return true;
};
CoachTools.getFeaturedGift = function (playerId) {
  const list = (Store.get().gifts || []).filter(g => g.playerId === playerId && g.attached !== false);
  const f = list.find(g => g.featured);
  if (f) return f;
  // fallback: highest rarity
  const rank = { legendary: 4, epic: 3, rare: 2, common: 1 };
  list.sort((a, b) => (rank[b.rarity] || 0) - (rank[a.rarity] || 0));
  return list[0] || null;
};
CoachTools.playerGifts = function (playerId) {
  return (Store.get().gifts || []).filter(g => g.playerId === playerId);
};
CoachTools.playerMoments = function (playerId) {
  return (Store.get().moments || []).filter(m => m.playerId === playerId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
};


/** Редагування / видалення подарунків (лише тренер) */
CoachTools.deleteGift = function (giftInstanceId) {
  const s = Store.get();
  if (!s.gifts) s.gifts = [];
  const before = s.gifts.length;
  s.gifts = s.gifts.filter(g => g.id !== giftInstanceId);
  if (s.gifts.length === before) return false;
  try { StorageManager.save(); } catch (_) {}
  if (typeof Toast !== 'undefined') Toast.show('Подарунок видалено', 'ok');
  try { if (typeof App !== 'undefined' && App.renderCurrent) App.renderCurrent(); } catch (_) {}
  return true;
};

CoachTools.editGiftNote = function (giftInstanceId, note) {
  const s = Store.get();
  const g = (s.gifts || []).find(x => x.id === giftInstanceId);
  if (!g) return false;
  g.note = String(note || '').trim();
  try { StorageManager.save(); } catch (_) {}
  if (typeof Toast !== 'undefined') Toast.show('Пам\'ятний момент оновлено', 'ok');
  return true;
};

CoachTools.detachGift = function (giftInstanceId) {
  const s = Store.get();
  const g = (s.gifts || []).find(x => x.id === giftInstanceId);
  if (!g) return false;
  g.attached = false;
  g.featured = false;
  try { StorageManager.save(); } catch (_) {}
  if (typeof Toast !== 'undefined') Toast.show('Знято з профілю', 'ok');
  return true;
};

CoachTools.toggleAttachGift = function (giftInstanceId) {
  const s = Store.get();
  const g = (s.gifts || []).find(x => x.id === giftInstanceId);
  if (!g) return false;
  g.attached = !(g.attached !== false);
  if (!g.attached) g.featured = false;
  try { StorageManager.save(); } catch (_) {}
  if (typeof Toast !== 'undefined') Toast.show(g.attached ? 'Прикріплено до профілю' : 'Знято з профілю', 'ok');
  return g.attached;
};

/** ID тренера в attendance */
CoachTools.COACH_ATT_ID = '__coach__';

CoachTools.coachAttendanceRate = function () {
  const s = Store.get();
  const past = (typeof LoadModel !== 'undefined' && LoadModel.pastTrainings)
    ? LoadModel.pastTrainings(s.trainings || [])
    : (s.trainings || []).filter(t => t.status === 'done' || (t.date && t.date <= (typeof today === 'function' ? today() : '')));
  if (!past.length) return 0;
  let present = 0;
  past.forEach(t => {
    const a = t.attendance && t.attendance[CoachTools.COACH_ATT_ID];
    // default: if training done and no explicit mark → coach present
    if (a) {
      if (a.present) present++;
    } else if (t.status === 'done' || t.coachPresent !== false) {
      present++;
    }
  });
  return Math.round((present / past.length) * 100);
};

CoachTools.setCoachAttendance = function (trainingId, present) {
  const s = Store.get();
  const t = (s.trainings || []).find(x => x.id === trainingId);
  if (!t) return false;
  if (!t.attendance) t.attendance = {};
  t.attendance[CoachTools.COACH_ATT_ID] = {
    present: !!present,
    intensity: present ? 7 : 0,
    note: 'Тренер'
  };
  t.coachPresent = !!present;
  try { StorageManager.save(); } catch (_) {}
  return true;
};

CoachTools.getCoachAchievements = function () {
  const s = Store.get();
  const set = s.settings || {};
  const cs = set.coachStats || s.coachStats || { appMs: 0, boardMs: 0 };
  const past = (s.trainings || []).filter(t => t.status === 'done');
  const planned = (s.trainings || []).filter(t => t.status === 'planned');
  const totalMin = past.reduce((a, t) => a + (t.duration || 0), 0);
  const giftsGiven = (s.gifts || []).length;
  const moments = (s.moments || []).length;
  const boards = (s.boards || []).length;
  const players = (s.players || []).length;
  return {
    appMs: cs.appMs || 0,
    boardMs: cs.boardMs || 0,
    trainingsDone: past.length,
    trainingsPlanned: planned.length,
    sessionMinutes: totalMin,
    boards,
    players,
    giftsGiven,
    moments,
    attendancePct: CoachTools.coachAttendanceRate()
  };
};

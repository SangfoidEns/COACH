/** Extracted module: src/core/storage.js lines 287-496 — DO NOT rewrite business logic */
/* ─── STORAGE MANAGER ───────────────────────────────────── */
const StorageManager = {
  _debouncedSave: null,

  init() {
    this._debouncedSave = debounce(() => this.save(), 500);
    const loaded = this.load();
    if (!loaded) {
      Store.reset();
      this.save();
    }
    // Фонова синхронізація з Telegram Cloud Storage
    setTimeout(() => {
      this.syncFromCloud().catch(() => {});
    }, 400);
  },

  save() {
    /* DATA INTEGRITY: never wipe keys on error */
    try {
      const s = Store.get();
      if (!s) return;
      s.updatedAt = new Date().toISOString();
      const payload = this._buildLocalPayload();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      this._scheduleCloudPush(payload);
    } catch (e) {
      ErrorManager.log('Storage.save', e);
      Toast.show('Не вдалося зберегти (квота storage?)', 'err');
    }
  },

  _buildLocalPayload() {
    const s = Store.get();
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: s.updatedAt || new Date().toISOString(),
      settings: s.settings,
      players: s.players,
      trainings: s.trainings,
      exercises: s.exercises,
      boards: s.boards,
      calendar: s.calendar,
      matches: s.matches,
      diary: s.diary || [],
      myExercises: s.myExercises || [],
      animations: s.animations || [],
      activeBoard: {
        objects: (s.activeBoard && s.activeBoard.objects) || [],
        fieldView: (s.activeBoard && s.activeBoard.fieldView) || 'full'
      }
    };
  },

  /* ── Telegram Cloud Storage sync (chunked, ≤~3500 chars/key) ── */
  CLOUD_META: 'ms_meta',
  CLOUD_PREFIX: 'ms_c_',
  CLOUD_CHUNK: 3200,
  _cloudTimer: null,

  _cloudApi() {
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      return tg && tg.CloudStorage ? tg.CloudStorage : null;
    } catch (_) { return null; }
  },

  _scheduleCloudPush(payload) {
    if (!this._cloudApi()) return;
    clearTimeout(this._cloudTimer);
    this._cloudTimer = setTimeout(() => this.pushToCloud(payload), 400);
  },

  pushToCloud(payload) {
    const cs = this._cloudApi();
    if (!cs) return;
    try {
      const text = JSON.stringify(payload || this._buildLocalPayload());
      // Якщо вміщується в один ключ (~4KB) — дубль metalist_state для сумісності
      if (text.length <= 3500) {
        try {
          cs.setItem('metalist_state', text, () => {});
        } catch (_) {}
      }
      const chunks = [];
      for (let i = 0; i < text.length; i += this.CLOUD_CHUNK) {
        chunks.push(text.slice(i, i + this.CLOUD_CHUNK));
      }
      const meta = JSON.stringify({
        updatedAt: (payload && payload.updatedAt) || new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
        chunks: chunks.length,
        size: text.length
      });
      // write meta + chunks sequentially
      const write = (key, val) => new Promise((resolve) => {
        try {
          cs.setItem(key, val, (err) => resolve(!err));
        } catch (_) { resolve(false); }
      });
      (async () => {
        await write(this.CLOUD_META, meta);
        for (let i = 0; i < chunks.length; i++) {
          await write(this.CLOUD_PREFIX + i, chunks[i]);
        }
        // optional: clear stale chunks
        await write(this.CLOUD_PREFIX + 'n', String(chunks.length));
      })().catch(e => console.warn('[CloudSync] push', e));
    } catch (e) {
      console.warn('[CloudSync] push', e);
    }
  },

  pullFromCloud() {
    return new Promise((resolve) => {
      const cs = this._cloudApi();
      if (!cs) return resolve(null);
      const readChunks = () => {
        try {
          cs.getItem(this.CLOUD_META, (err, metaRaw) => {
            if (err || !metaRaw) return resolve(null);
            let meta;
            try { meta = JSON.parse(metaRaw); } catch (_) { return resolve(null); }
            const n = meta.chunks || 0;
            if (!n) return resolve(null);
            const parts = new Array(n);
            let left = n;
            let failed = false;
            for (let i = 0; i < n; i++) {
              ((idx) => {
                cs.getItem(this.CLOUD_PREFIX + idx, (e2, chunk) => {
                  if (e2 || chunk == null) failed = true;
                  else parts[idx] = chunk;
                  left--;
                  if (left === 0) {
                    if (failed) return resolve(null);
                    try {
                      const text = parts.join('');
                      const data = JSON.parse(text);
                      data.updatedAt = meta.updatedAt || data.updatedAt;
                      resolve(data);
                    } catch (_) { resolve(null); }
                  }
                });
              })(i);
            }
          });
        } catch (_) { resolve(null); }
      };
      try {
        cs.getItem('metalist_state', (e0, single) => {
          if (!e0 && single) {
            try {
              const data = JSON.parse(single);
              if (data && typeof data === 'object') return resolve(data);
            } catch (_) {}
          }
          readChunks();
        });
      } catch (_) {
        readChunks();
      }
    });
  },

  async syncFromCloud() {
    try {
      const cloud = await this.pullFromCloud();
      if (!cloud) return false;
      const localRaw = localStorage.getItem(STORAGE_KEY);
      let localAt = 0;
      if (localRaw) {
        try { localAt = Date.parse(JSON.parse(localRaw).updatedAt || 0) || 0; } catch (_) {}
      }
      const cloudAt = Date.parse(cloud.updatedAt || 0) || 0;
      if (cloudAt > localAt) {
        this.createBackup();
        const migrated = this.migrate(cloud, cloud.schemaVersion || 1);
        Store.set(migrated);
        // write local without re-push loop storm
        const payload = this._buildLocalPayload();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        Toast.show('Синхронізовано з Telegram Cloud', 'ok');
        try { if (typeof App !== 'undefined') { App.applyBranding(); App.renderCurrent(); } } catch (_) {}
        try { if (typeof AuthManager !== 'undefined') { AuthManager._resolveRole(); AuthManager._applyUiRole(); } } catch (_) {}
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[CloudSync] pull', e);
      return false;
    }
  },

  saveDebounced() {
    const s = Store.get();
    if (s?.settings?.autosave !== false) this._debouncedSave();
  },

  load() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // migrate from v1
        raw = localStorage.getItem(LEGACY_KEY);
        if (raw) {
          const legacy = JSON.parse(raw);
          const migrated = this.migrate(legacy, 1);
          if (!Array.isArray(migrated.diary)) migrated.diary = [];
        if (!Array.isArray(migrated.myExercises)) migrated.myExercises = [];
        if (!Array.isArray(migrated.animations)) migrated.animations = [];
        Store.set(migrated);
          this.save();
          localStorage.removeItem(LEGACY_KEY);
          Toast.show('Дані мігровано з v1', 'ok');
          return true;
        }
        return false;
      }
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') throw new Error('Invalid data');
      const version = data.schemaVersion || 1;
      const migrated = this.migrate(data, version);
      Store.set(migrated);
      return true;
    } catch (e) {
      ErrorManager.log('Storage.load', e);
      // try backup
      try {
        const bak = localStorage.getItem(BACKUP_KEY);
        if (bak) {
          const data = JSON.parse(bak);
          Store.set(this.migrate(data, data.schemaVersion || 1));
          Toast.show('Відновлено з резервної копії', 'warn');
          return true;
        }
      } catch (_) {}
      return false;
    }
  },

  migrate(data, fromVersion) {
    const base = Store._default();
    // merge known fields
    if (data.settings) Object.assign(base.settings, data.settings);
    if (Array.isArray(data.players) && data.players.length) base.players = data.players.map(this.normalizePlayer);
    if (Array.isArray(data.trainings)) base.trainings = data.trainings;
    if (Array.isArray(data.exercises) && data.exercises.length) base.exercises = data.exercises;
    if (Array.isArray(data.boards)) base.boards = data.boards;
    if (Array.isArray(data.calendar)) base.calendar = data.calendar;
    if (Array.isArray(data.matches)) base.matches = data.matches;
    if (data.activeBoard) {
      base.activeBoard.objects = (data.activeBoard.objects || data.activeBoard.players || []).map(o => this.normalizeBoardObj(o));
      // convert old format players → objects
      if (data.activeBoard.players && !data.activeBoard.objects) {
        base.activeBoard.objects = data.activeBoard.players.map(p => ({
          id: p.id || uid(), type: p.type === 'gk' ? 'player' : (p.type || 'player'),
          x: (p.x > 1 ? p.x / 100 : p.x) || 0.5, y: (p.y > 1 ? p.y / 100 : p.y) || 0.5,
          number: p.number, label: p.name || '', team: p.type === 'opp' ? 'opp' : 'own',
          playerId: null
        }));
        if (data.activeBoard.ball) {
          base.activeBoard.objects.push({
            id: uid(), type: 'ball',
            x: data.activeBoard.ball.x > 1 ? data.activeBoard.ball.x / 100 : data.activeBoard.ball.x,
            y: data.activeBoard.ball.y > 1 ? data.activeBoard.ball.y / 100 : data.activeBoard.ball.y
          });
        }
        if (data.activeBoard.drawings) {
          data.activeBoard.drawings.forEach(d => {
            base.activeBoard.objects.push(this.normalizeBoardObj(d));
          });
        }
      }
      if (data.activeBoard.fieldView) base.activeBoard.fieldView = data.activeBoard.fieldView;
    }
    if (!base.settings.rbac) {
      base.settings.rbac = { coaches: [], playerLinks: {} };
    }
    base.schemaVersion = SCHEMA_VERSION;
    return base;
  },

  normalizePlayer(p) {
    if (!p) return null;
    let status = p.status || p.healthStatus || 'available';
    if (status === 'healthy') status = 'available';
    if (status === 'recovery') status = 'rehab';
    return {
      id: p.id || uid(),
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      number: p.number || 0,
      position: p.position || 'CM',
      secondaryPositions: p.secondaryPositions || [],
      age: p.age || 20,
      status,
      healthStatus: p.healthStatus || status,
      isCaptain: !!p.isCaptain,
      condition: p.condition ?? 90,
      readiness: p.readiness ?? 90,
      load: p.load ?? 0,
      notes: p.notes || '',
      group: p.group || 'main',
      tags: p.tags || [],
      telegramUsername: (p.telegramUsername || p.tgUsername || '').replace(/^@/, ''),
      telegramId: p.telegramId || p.tgId || null,
      phone: p.phone || ''
    };
  },

  normalizeBoardObj(o) {
    if (!o) return null;
    const x = o.x != null ? (o.x > 1 ? o.x / 100 : o.x) : 0.5;
    const y = o.y != null ? (o.y > 1 ? o.y / 100 : o.y) : 0.5;
    let status = o.status || o.healthStatus || null;
    if (status === 'healthy') status = 'available';
    if (status === 'recovery') status = 'rehab';
    return {
      id: o.id || uid(),
      type: o.type || 'player',
      x: clamp(x, 0, 1), y: clamp(y, 0, 1),
      x2: o.x2 != null ? (o.x2 > 1 ? o.x2 / 100 : o.x2) : undefined,
      y2: o.y2 != null ? (o.y2 > 1 ? o.y2 / 100 : o.y2) : undefined,
      w: o.w != null ? (o.w > 1 ? o.w / 100 : o.w) : undefined,
      h: o.h != null ? (o.h > 1 ? o.h / 100 : o.h) : undefined,
      r: o.r != null ? (o.r > 1 ? o.r / 100 : o.r) : undefined,
      number: o.number,
      label: o.label || o.name || o.text || '',
      team: o.team || (o.type === 'opp' || o.type === 'opponent' ? 'opp' : 'own'),
      playerId: o.playerId || null,
      color: o.color,
      chipColor: o.chipColor || o.color || undefined,
      fill: o.fill,
      status,
      isCaptain: !!o.isCaptain,
      readiness: o.readiness != null ? o.readiness : undefined,
      load: o.load != null ? o.load : undefined,
      position: o.position || undefined,
      onBench: !!o.onBench,
      step: o.step,
      locked: !!o.locked,
      visible: o.visible !== false,
      rotation: o.rotation || 0
    };
  },

  createBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
    } catch (e) { ErrorManager.log('backup', e); }
  },

  buildExportPayload() {
    const s = Store.get();
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      settings: s.settings,
      players: s.players,
      trainings: s.trainings,
      exercises: s.exercises,
      boards: s.boards,
      calendar: s.calendar,
      matches: s.matches,
      diary: s.diary || [],
      myExercises: s.myExercises || [],
      animations: s.animations || [],
      activeBoard: {
        objects: (s.activeBoard && s.activeBoard.objects) || [],
        fieldView: (s.activeBoard && s.activeBoard.fieldView) || 'full'
      }
    };
  },

  async exportJSON() {
    this.beginIoLock(3000);
    try {
      this.createBackup();
      const payload = this.buildExportPayload();
      const text = JSON.stringify(payload, null, 2);
      const filename = 'metalist_stuttgart_' + (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10)) + '.json';
      const inTg = !!(typeof TelegramManager !== 'undefined' && TelegramManager.isTelegram);

      // У Telegram / на мобільних — діалог вибору способу (найзручніше)
      if (inTg || (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) || !window.showSaveFilePicker) {
        this._openExportChooser(text, filename);
        return;
      }

      // Desktop Chromium: спроба «Зберегти як»
      try {
        if (typeof window.showSaveFilePicker === 'function') {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(text);
          await writable.close();
          Toast.show('Файл збережено', 'ok');
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }

      this._openExportChooser(text, filename);
    } catch (e) {
      try { ErrorManager.log('export', e); } catch (_) {}
      Toast.show('Помилка експорту: ' + (e.message || e), 'err');
    }
  },

  _openExportChooser(text, filename) {
    const sizeKb = Math.round(new Blob([text]).size / 1024);
    const body = `
      <p style="font-size:13px;color:var(--muted);margin:0 0 12px;line-height:1.45">
        Експорт даних МЕТАЛІСТ ШТУТГАРТ · <strong>${sizeKb} КБ</strong><br>
        У Telegram найнадійніше — <strong>скопіювати</strong> і зберегти в «Вибране» або надіслати собі в Saved Messages.
      </p>
      <div class="export-actions" style="display:flex;flex-direction:column;gap:8px">
        <button type="button" class="btn btn-p" data-export-act="copy" style="min-height:48px;width:100%">📋 Скопіювати JSON у буфер</button>
        <button type="button" class="btn btn-s" data-export-act="share" style="min-height:44px;width:100%">📤 Поділитися / Share</button>
        <button type="button" class="btn btn-s" data-export-act="download" style="min-height:44px;width:100%">⬇️ Завантажити файл</button>
        <button type="button" class="btn btn-s" data-export-act="show" style="min-height:44px;width:100%">👁 Показати текст (ручне копіювання)</button>
      </div>
      <textarea id="exportJsonTa" readonly
        style="display:none;width:100%;height:160px;margin-top:12px;font-size:11px;font-family:ui-monospace,monospace;
        background:rgba(0,0,0,0.35);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:10px;box-sizing:border-box"></textarea>
      <p class="note-sm" style="margin-top:10px">Після копіювання: відкрийте Saved Messages у Telegram → вставте → збережіть як файл, або вставте назад через «Імпорт JSON».</p>
    `;
    Modal.open('Експорт JSON', body, [
      { label: 'Закрити', cls: 'btn-s', action: 'cancel' }
    ]);
    const ta = () => document.getElementById('exportJsonTa');
    setTimeout(() => {
      document.querySelectorAll('[data-export-act]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const act = btn.getAttribute('data-export-act');
          if (act === 'copy') {
            const ok = await this._copyText(text);
            if (ok) {
              try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
              Toast.show('Скопійовано! Вставте у Saved Messages', 'ok');
            } else {
              // fallback: show textarea
              const el = ta();
              if (el) {
                el.style.display = 'block';
                el.value = text;
                el.focus();
                el.select();
              }
              Toast.show('Виділіть текст і скопіюйте вручну', 'warn');
            }
          } else if (act === 'share') {
            await this._shareExport(text, filename);
          } else if (act === 'download') {
            this._downloadExport(text, filename);
          } else if (act === 'show') {
            const el = ta();
            if (el) {
              el.style.display = 'block';
              el.value = text;
              el.focus();
              el.select();
              try { el.setSelectionRange(0, el.value.length); } catch (_) {}
            }
          }
        });
      });
    }, 40);
  },

  async _copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (_) {
      return false;
    }
  },

  async _shareExport(text, filename) {
    try {
      const file = new File([text], filename, { type: 'application/json' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'МЕТАЛІСТ ШТУТГАРТ', text: 'Експорт тренерських даних' });
        Toast.show('Надіслано', 'ok');
        return;
      }
      if (navigator.share) {
        // Багато WebView не шарять довгий text — копіюємо і підказуємо
        if (text.length > 40000) {
          await this._copyText(text);
          Toast.show('Файл великий: JSON скопійовано в буфер', 'ok');
          return;
        }
        await navigator.share({ title: filename, text: text });
        Toast.show('Надіслано', 'ok');
        return;
      }
      Toast.show('Share недоступний — скористайтесь «Скопіювати»', 'warn');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      Toast.show('Share не вдався — спробуйте скопіювати', 'warn');
    }
  },

  _downloadExport(text, filename) {
    try {
      // data: надійніше в Telegram WebView за blob:
      const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      Toast.show('Завантаження… Якщо файл не з’явився — скопіюйте JSON', 'ok');
      return;
    } catch (_) {}
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      Toast.show('Завантаження…', 'ok');
    } catch (e) {
      Toast.show('Завантаження недоступне — скопіюйте JSON', 'err');
    }
  },



  /** Чи iOS / Telegram WebView — без showOpenFilePicker */
  /** iOS / Telegram WebView */
  _isMobileWebView() {
    try {
      if (typeof TelegramManager !== 'undefined' && TelegramManager.isTelegram) return true;
      const ua = navigator.userAgent || '';
      return /iPhone|iPad|iPod|Android/i.test(ua);
    } catch (_) { return true; }
  },

  /** Блокування роутера під час файлових операцій (iOS повертає focus і «клікає» логотип) */
  _ioLock: false,
  _ioLockTimer: null,
  beginIoLock(ms) {
    this._ioLock = true;
    clearTimeout(this._ioLockTimer);
    this._ioLockTimer = setTimeout(() => { this._ioLock = false; }, ms || 2500);
    try { document.body.classList.add('ms-io-lock'); } catch (_) {}
  },
  endIoLock() {
    clearTimeout(this._ioLockTimer);
    this._ioLock = false;
    try { document.body.classList.remove('ms-io-lock'); } catch (_) {}
  },
  isIoLocked() { return !!this._ioLock; },

  /**
   * Єдиний прихований input для iOS / Telegram.
   * id="ios-json-input" — поза будь-яким view, ніколи не remount-иться.
   */
  _ensureImportInput() {
    let inp = document.getElementById('ios-json-input');
    if (inp) return inp;
    inp = document.createElement('input');
    inp.type = 'file';
    inp.id = 'ios-json-input';
    inp.accept = '.json,application/json,text/json,text/plain,*/*';
    inp.setAttribute('aria-hidden', 'true');
    inp.tabIndex = -1;
    inp.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;opacity:0;pointer-events:none;border:0;padding:0;margin:0;';
    document.body.appendChild(inp);
    inp.addEventListener('change', (event) => {
      try {
        if (event && event.preventDefault) event.preventDefault();
        if (event && event.stopPropagation) event.stopPropagation();
      } catch (_) {}
      const file = event.target.files && event.target.files[0];
      const clear = () => { try { event.target.value = ''; } catch (_) {} };
      if (!file) {
        clear();
        this.endIoLock();
        return;
      }
      this.beginIoLock(4000);
      this.importJSON(file).finally(() => {
        clear();
        // тримаємо lock ще трохи, поки iOS повертає фокус
        setTimeout(() => this.endIoLock(), 800);
      });
    });
    return inp;
  },

  /**
   * Відкрити вибір файлу. Викликати СИНХРОННО з user gesture.
   * Не викликає navigate / openDefaultBoard.
   */
  pickAndImportJSON() {
    this.beginIoLock(5000);
    try {
      if (!this._isMobileWebView() && typeof window.showOpenFilePicker === 'function') {
        window.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'], 'text/plain': ['.json', '.txt'] } }]
        }).then(async (handles) => {
          if (handles && handles[0]) {
            const file = await handles[0].getFile();
            await this.importJSON(file);
          }
        }).catch((e) => {
          if (e && e.name === 'AbortError') return;
          this._triggerFileInput();
        }).finally(() => {
          setTimeout(() => this.endIoLock(), 600);
        });
        return;
      }
    } catch (e) {
      console.warn('[import] picker', e);
    }
    this._triggerFileInput();
  },

  _triggerFileInput() {
    try {
      const inp = this._ensureImportInput();
      inp.value = '';
      // Синхронний click у межах жесту (критично для iOS)
      inp.click();
    } catch (e2) {
      console.error(e2);
      Toast.show('Не вдалося відкрити вибір файлу', 'err');
      this.endIoLock();
    }
  },

  importJSON(fileOrText) {
    const applyData = (raw) => {
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!data || typeof data !== 'object') throw new Error('Невірний формат JSON');
        // мінімальна валідація структури експорту
        if (!data.players && !data.activeBoard && !data.schemaVersion && !data.trainings && !data.boards && !data.schemes) {
          throw new Error('Некоректний формат JSON файлу');
        }
        this.createBackup();
        const migrated = this.migrate(data, data.schemaVersion || 1);
        Store.set(migrated);
        this.save();
        // Telegram CloudStorage (якщо є)
        try {
          if (typeof TelegramManager !== 'undefined' && TelegramManager.tg && TelegramManager.tg.CloudStorage) {
            const payload = JSON.stringify(Store.get());
            // обмеження CloudStorage — зберігаємо лише ключ-маркер
            TelegramManager.tg.CloudStorage.setItem('ms_last_import', String(Date.now()), () => {});
          }
        } catch (_) {}
        try { App.applyBranding(); } catch (_) {}
        try { App.renderCurrent(); } catch (_) {}
        try { this.pushToCloud(this._buildLocalPayload()); } catch (_) {}
        Toast.show('Успішно! Дані повністю оновлено.', 'ok');
        return true;
      } catch (e) {
        try { ErrorManager.log('import', e); } catch (_) {}
        Toast.show('Помилка файлу JSON: ' + (e.message || e), 'err');
        return false;
      }
    };

    return new Promise((resolve) => {
      const done = (ok) => resolve(!!ok);

      // Рядок JSON напряму
      if (typeof fileOrText === 'string') {
        done(applyData(fileOrText));
        return;
      }
      if (!fileOrText) {
        Toast.show('Файл не вибрано', 'err');
        done(false);
        return;
      }

      const readText = async () => {
        try {
          if (typeof fileOrText.text === 'function') {
            const text = await fileOrText.text();
            if (!text) { Toast.show('Порожній файл', 'err'); return false; }
            return applyData(String(text));
          }
        } catch (e) {
          console.warn('[import] file.text', e);
        }
        return await new Promise((res) => {
          const reader = new FileReader();
          reader.onerror = () => {
            Toast.show('Помилка зчитування файлу на iOS', 'err');
            res(false);
          };
          reader.onload = (ev) => {
            const text = ev.target && ev.target.result;
            if (text == null || text === '') {
              Toast.show('Порожній файл', 'err');
              res(false);
              return;
            }
            res(applyData(String(text)));
          };
          try {
            reader.readAsText(fileOrText, 'UTF-8');
          } catch (e) {
            try {
              const r2 = new FileReader();
              r2.onload = (ev2) => {
                try {
                  const text = new TextDecoder('utf-8').decode(ev2.target.result);
                  res(applyData(text));
                } catch (e2) {
                  Toast.show('Помилка зчитування файлу на iOS', 'err');
                  res(false);
                }
              };
              r2.onerror = () => { Toast.show('Помилка зчитування файлу на iOS', 'err'); res(false); };
              r2.readAsArrayBuffer(fileOrText);
            } catch (e3) {
              Toast.show('Імпорт недоступний у цьому середовищі', 'err');
              res(false);
            }
          }
        });
      };

      readText().then(done).catch((err) => {
        console.error('JSON Import Error:', err);
        Toast.show('Помилка зчитування файлу на iOS', 'err');
        done(false);
      });
    });
  },


  clear() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    Store.reset();
    this.save();
  }
};


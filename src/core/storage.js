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
  },

  save() {
    try {
      const s = Store.get();
      if (!s) return;
      const payload = {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
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
          objects: s.activeBoard.objects,
          fieldView: s.activeBoard.fieldView
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      ErrorManager.log('Storage.save', e);
      Toast.show('Не вдалося зберегти (квота storage?)', 'err');
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
    base.schemaVersion = SCHEMA_VERSION;
    return base;
  },

  normalizePlayer(p) {
    return {
      id: p.id || uid(), firstName: p.firstName || '', lastName: p.lastName || '',
      number: p.number || 0, position: p.position || 'CM', secondaryPositions: p.secondaryPositions || [],
      age: p.age || 20, status: p.status || 'available', condition: p.condition ?? 90,
      readiness: p.readiness ?? 90, load: p.load ?? 0, notes: p.notes || '', group: p.group || 'main', tags: p.tags || []
    };
  },

  normalizeBoardObj(o) {
    if (!o) return null;
    const x = o.x != null ? (o.x > 1 ? o.x / 100 : o.x) : 0.5;
    const y = o.y != null ? (o.y > 1 ? o.y / 100 : o.y) : 0.5;
    return {
      id: o.id || uid(),
      type: o.type || 'player',
      x: clamp(x, 0, 1), y: clamp(y, 0, 1),
      x2: o.x2 != null ? (o.x2 > 1 ? o.x2 / 100 : o.x2) : undefined,
      y2: o.y2 != null ? (o.y2 > 1 ? o.y2 / 100 : o.y2) : undefined,
      w: o.w != null ? (o.w > 1 ? o.w / 100 : o.w) : undefined,
      h: o.h != null ? (o.h > 1 ? o.h / 100 : o.h) : undefined,
      r: o.r != null ? (o.r > 1 ? o.r / 100 : o.r) : undefined,
      number: o.number, label: o.label || o.name || o.text || '',
      team: o.team || (o.type === 'opp' ? 'opp' : 'own'),
      playerId: o.playerId || null,
      color: o.color
    };
  },

  createBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
    } catch (e) { ErrorManager.log('backup', e); }
  },

  exportJSON() {
    this.createBackup();
    const s = Store.get();
    const payload = {
      schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(),
      settings: s.settings, players: s.players, trainings: s.trainings,
      exercises: s.exercises, boards: s.boards, calendar: s.calendar, matches: s.matches,
      activeBoard: { objects: s.activeBoard.objects, fieldView: s.activeBoard.fieldView }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'metalist_stuttgart_' + today() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.show('Експортовано', 'ok');
  },

  importJSON(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || typeof data !== 'object') throw new Error('Невірний формат');
        this.createBackup();
        const migrated = this.migrate(data, data.schemaVersion || 1);
        Store.set(migrated);
        this.save();
        App.renderCurrent();
        Toast.show('Імпортовано успішно', 'ok');
      } catch (e) {
        ErrorManager.log('import', e);
        Toast.show('Помилка імпорту: ' + e.message, 'err');
      }
    };
    reader.readAsText(file);
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    Store.reset();
    this.save();
  }
};


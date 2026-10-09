/** Extracted module: src/core/store.js lines 240-286 — DO NOT rewrite business logic */
/* ─── APP STATE ─────────────────────────────────────────── */
const Store = (() => {
  let state = null;
  const listeners = new Set();

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      settings: {
        clubName: 'МЕТАЛІСТ ШТУТГАРТ', clubShort: 'МШ', primary: '#1a3a5c', accent: '#c8a84b',
        logoData: null, defaultDuration: 90, defaultIntensity: 6, autosave: true, sound: true, theme: 'dark'
      },
      players: JSON.parse(JSON.stringify(DEMO.players)),
      trainings: [],
      exercises: JSON.parse(JSON.stringify(DEMO.exercises)),
      boards: [],
      calendar: [],
      matches: [],
      diary: [],
      myExercises: [],
      animations: [],
      activeBoard: { objects: [], history: [], historyIdx: -1, selectedId: null, tool: 'select', fieldView: 'full', anim: { playing: false, frame: 0, paths: [], speed: 1 } },
      ui: { view: 'dashboard', selectedDay: today(), calDate: today(), calView: 'month' },
      timer: { mainStart: null, mainElapsed: 0, mainRunning: false, exStart: null, exElapsed: 0, exRunning: false }
    };
  }

  return {
    get() { return state; },
    getSlice(key) { return state ? state[key] : null; },
    set(next) {
      state = next;
      state.updatedAt = new Date().toISOString();
      listeners.forEach(fn => { try { fn(state); } catch (e) { ErrorManager.log('subscriber', e); } });
    },
    update(fn) {
      if (!state) return;
      const draft = fn(state);
      if (draft !== false) this.set(state);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reset() { state = defaultState(); listeners.forEach(fn => fn(state)); },
    _default: defaultState
  };
})();


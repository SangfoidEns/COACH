/**
 * Persistence: IndexedDB primary, localStorage fallback.
 * Schema versioned + migration safe.
 */
const DB_NAME = 'metalist_coach_db';
const DB_VERSION = 1;
const STORE = 'app';
const LS_KEY = 'metalist_coach_v3';
const SCHEMA = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!indexedDB) return reject(new Error('No IDB'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const StorageManager = {
  schema: SCHEMA,

  async save(state) {
    const payload = {
      schemaVersion: SCHEMA,
      updatedAt: new Date().toISOString(),
      ...state,
    };
    try {
      await idbSet('state', payload);
    } catch {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
      } catch (e) {
        console.error('[Storage] save failed', e);
      }
    }
  },

  async load() {
    try {
      const data = await idbGet('state');
      if (data) return this.migrate(data);
    } catch {}
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return this.migrate(JSON.parse(raw));
    } catch {}
    return null;
  },

  migrate(data) {
    if (!data || typeof data !== 'object') return null;
    data.schemaVersion = SCHEMA;
    if (!Array.isArray(data.players)) data.players = [];
    if (!Array.isArray(data.trainings)) data.trainings = [];
    if (!Array.isArray(data.exercises)) data.exercises = [];
    if (!Array.isArray(data.scenes)) data.scenes = [];
    if (!data.settings) data.settings = {};
    if (!data.board) data.board = { objects: [], camera: { x: 0, y: 0, zoom: 1 } };
    return data;
  },

  exportJSON(state) {
    const blob = new Blob([JSON.stringify({ schemaVersion: SCHEMA, ...state }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `metalist_coach_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async importJSON(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    return this.migrate(data);
  },
};

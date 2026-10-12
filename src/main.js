/**
 * METALIST STUTTGART — Coaching System v3
 * Entry point
 */
import { TacticalBoardEngine } from './board/TacticalBoardEngine.js';
import { StorageManager } from './storage/StorageManager.js';
import { TelegramManager } from './telegram/TelegramManager.js';
import { store, createDefaultState } from './state/store.js';
import { uid } from './utils/math.js';

let board = null;
let boardOnly = false;
let saveTimer = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function debounceSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = store.get();
    if (board) s.board = board.getState();
    StorageManager.save(s);
  }, 600);
}

async function boot() {
  TelegramManager.init();

  const saved = await StorageManager.load();
  if (saved) store.replace(saved);
  else store.set(createDefaultState());

  initNav();
  initBoard();
  initToolbar();
  initKeyboard();
  renderPlayers();
  renderTrainings();
  renderScenes();
  showView('board');

  // Auto-enter board-only in Telegram
  if (TelegramManager.isTelegram) {
    setTimeout(() => enterBoardOnly(), 400);
  }
}

function initBoard() {
  const canvas = $('#boardCanvas');
  if (!canvas) return;
  board = new TacticalBoardEngine(canvas, {
    onChange: () => {
      store.get().board = board.getState();
      debounceSave();
      renderScenes();
    },
  });
  const s = store.get();
  if (s.board?.objects?.length) board.loadState(s.board);
  else board.applyFormation('4-3-3');
}

function initNav() {
  $$('[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showView(el.dataset.view);
    });
  });
}

function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-' + name));
  $$('[data-view]').forEach((n) => n.classList.toggle('on', n.dataset.view === name));
  if (name === 'board' && board) {
    setTimeout(() => board._resize(), 50);
  }
}

function initToolbar() {
  const bar = $('#toolbar');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tool],[data-act]');
    if (!btn) return;
    if (btn.dataset.tool) {
      board?.setTool(btn.dataset.tool);
      $$('[data-tool]').forEach((b) => b.classList.toggle('on', b === btn));
    }
    const act = btn.dataset.act;
    if (act === 'fs') toggleBoardOnly();
    if (act === 'undo') board?.undo();
    if (act === 'redo') board?.redo();
    if (act === 'clear') {
      if (confirm('Очистити дошку?')) board?.clear();
    }
    if (act === 'save-scene') saveScene();
    if (act === 'play') board?.play();
    if (act === 'pause') board?.pause();
    if (act === 'stop') board?.stop();
    if (act === 'formation') {
      const name = btn.dataset.f;
      if (name) board?.applyFormation(name);
    }
    if (act === 'zoom-in') {
      board.camera.zoom = Math.min(5, board.camera.zoom * 1.2);
      board.needsRender = true;
    }
    if (act === 'zoom-out') {
      board.camera.zoom = Math.max(0.4, board.camera.zoom / 1.2);
      board.needsRender = true;
    }
    if (act === 'zoom-fit') {
      board.camera = { x: 0, y: 0, zoom: 1 };
      board.needsRender = true;
    }
    if (act === 'add-kf') {
      if (board?.selectedId) {
        board.addKeyframe(board.selectedId, board.anim.t || 0);
        toast('Keyframe додано');
      } else toast('Виберіть гравця', 'warn');
    }
    if (act === 'export') StorageManager.exportJSON(store.get());
    if (act === 'new-training') createTraining();
  });
}

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') {
      if (boardOnly) exitBoardOnly();
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleBoardOnly();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      board?.undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      board?.redo();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      board?.deleteSelected();
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (board?.anim.playing) board.pause();
      else board?.play();
    }
  });
}

/* ── Board Only / Fullscreen ── */
async function enterBoardOnly() {
  boardOnly = true;
  document.body.classList.add('board-only');
  showView('board');
  await TelegramManager.requestFullscreen();
  TelegramManager.lockLandscape();
  setTimeout(() => board?._resize(), 100);
  toast('Board Only — ESC / EXIT для виходу');
}

async function exitBoardOnly() {
  boardOnly = false;
  document.body.classList.remove('board-only');
  await TelegramManager.exitFullscreen();
  TelegramManager.unlockOrientation();
  setTimeout(() => board?._resize(), 100);
}

function toggleBoardOnly() {
  if (boardOnly) exitBoardOnly();
  else enterBoardOnly();
}

/* ── Scenes ── */
function saveScene() {
  if (!board) return;
  const name = prompt('Назва сцени:', 'Сцена ' + (store.get().scenes.length + 1));
  if (!name) return;
  store.update((s) => {
    s.scenes.push({
      id: uid(),
      name,
      board: board.getState(),
      createdAt: new Date().toISOString(),
    });
  });
  debounceSave();
  renderScenes();
  toast('Сцену збережено');
}

function loadScene(id) {
  const sc = store.get().scenes.find((x) => x.id === id);
  if (!sc || !board) return;
  board.loadState(sc.board);
  showView('board');
  toast('Завантажено: ' + sc.name);
}

function renderScenes() {
  const el = $('#sceneList');
  if (!el) return;
  const scenes = store.get().scenes;
  el.innerHTML = scenes.length
    ? scenes
        .map(
          (sc) => `
      <div class="scene-item">
        <span>${sc.name}</span>
        <div>
          <button data-load-scene="${sc.id}">Відкрити</button>
          <button data-del-scene="${sc.id}" class="danger">✕</button>
        </div>
      </div>`
        )
        .join('')
    : '<p class="muted">Немає сцен. Збережіть з дошки.</p>';
  el.querySelectorAll('[data-load-scene]').forEach((b) =>
    b.addEventListener('click', () => loadScene(b.dataset.loadScene))
  );
  el.querySelectorAll('[data-del-scene]').forEach((b) =>
    b.addEventListener('click', () => {
      store.update((s) => {
        s.scenes = s.scenes.filter((x) => x.id !== b.dataset.delScene);
      });
      debounceSave();
      renderScenes();
    })
  );
}

/* ── Players ── */
function renderPlayers() {
  const el = $('#playerList');
  if (!el) return;
  const players = store.get().players;
  el.innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Ім'я</th><th>Поз.</th><th>Статус</th></tr></thead>
      <tbody>
        ${players
          .map(
            (p) =>
              `<tr><td>${p.number}</td><td>${p.firstName} ${p.lastName}</td><td>${p.position}</td><td>${p.status}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`;
}

/* ── Trainings ── */
function createTraining() {
  const name = prompt('Назва тренування:', 'Тренування');
  if (!name) return;
  store.update((s) => {
    s.trainings.push({
      id: uid(),
      name,
      date: new Date().toISOString().slice(0, 10),
      duration: 90,
      exercises: [],
      sceneIds: store.get().scenes.map((sc) => sc.id),
      status: 'draft',
    });
  });
  debounceSave();
  renderTrainings();
  toast('Тренування створено');
}

function renderTrainings() {
  const el = $('#trainingList');
  if (!el) return;
  const list = store.get().trainings;
  el.innerHTML = list.length
    ? list
        .map(
          (t) => `
      <div class="card">
        <strong>${t.name}</strong>
        <div class="muted">${t.date} · ${t.duration}хв · сцен: ${(t.sceneIds || []).length}</div>
      </div>`
        )
        .join('')
    : '<p class="muted">Немає тренувань</p>';
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts')?.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// EXIT board button
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-act="exit-fs"]')) exitBoardOnly();
});

document.addEventListener('DOMContentLoaded', boot);

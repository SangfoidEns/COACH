/** Extracted module: src/ui/app.js lines 2014-2394 — DO NOT rewrite business logic */
const App = {
  init() {
    TelegramManager.init();
    StorageManager.init();
    this.applyBranding();
    this.bindEvents();
    this.initFloatingNav();
    BoardEngine.init();
    this.navigate(Store.get().ui.view || 'dashboard');
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    // init board history
    const b = Store.get().activeBoard;
    if (!b.history.length) {
      b.history = [JSON.stringify(b.objects)];
      b.historyIdx = 0;
    }
    Toast.show('МЕТАЛІСТ ШТУТГАРТ — тренерська платформа', 'ok');
  },

  applyBranding() {
    const s = Store.get().settings;
    document.documentElement.style.setProperty('--club-primary', s.primary);
    document.documentElement.style.setProperty('--club-secondary', s.accent);
    document.documentElement.style.setProperty('--club-accent', s.accent);
    const logo = document.getElementById('clubLogo');
    if (s.logoData) {
      logo.innerHTML = `<img src="${s.logoData}" alt="logo">`;
    } else {
      logo.textContent = s.clubShort;
    }
    const parts = s.clubName.split(' ');
    document.getElementById('clubName').innerHTML = parts.length > 1
      ? sanitize(parts[0]) + ' <span>' + sanitize(parts.slice(1).join(' ')) + '</span>'
      : sanitize(s.clubName);
  },


  initFloatingNav() {
    document.body.classList.add('nav-float');
    const sb = document.getElementById('sidebar');
    const handle = document.getElementById('sbDrag');
    if (!sb || !handle) return;
    // restore position
    try {
      const pos = JSON.parse(localStorage.getItem('ms_nav_pos') || 'null');
      if (pos && typeof pos.left === 'number') {
        sb.style.left = pos.left + 'px';
        sb.style.top = pos.top + 'px';
        sb.style.right = 'auto';
      }
    } catch (_) {}
    let dragging = false, ox = 0, oy = 0;
    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      const r = sb.getBoundingClientRect();
      const cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX);
      const cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
      ox = cx - r.left;
      oy = cy - r.top;
      handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX);
      const cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
      if (cx == null) return;
      let left = cx - ox;
      let top = cy - oy;
      const maxL = window.innerWidth - sb.offsetWidth - 8;
      const maxT = window.innerHeight - 40;
      left = Math.max(8, Math.min(maxL, left));
      top = Math.max(8, Math.min(maxT, top));
      sb.style.left = left + 'px';
      sb.style.top = top + 'px';
      sb.style.right = 'auto';
      sb.style.bottom = 'auto';
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      try {
        localStorage.setItem('ms_nav_pos', JSON.stringify({
          left: parseFloat(sb.style.left) || 12,
          top: parseFloat(sb.style.top) || 68
        }));
      } catch (_) {}
    };
    handle.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  },

  navigate(view) {
    Store.get().ui.view = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
    const el = document.getElementById('v-' + view);
    if (el) el.classList.add('on');
    document.querySelectorAll('.nav, .mni').forEach(n => n.classList.toggle('on', n.dataset.view === view));
    // Canvas-first workspace on board
    if (view === 'board') {
      document.body.classList.add('board-workspace');
      // default: hide nav & props, keep tools
      document.body.classList.remove('bw-nav', 'bw-props', 'bw-tools-collapsed');
    } else {
      document.body.classList.remove('board-workspace', 'bw-nav', 'bw-props', 'bw-tools-collapsed');
    }
    this.renderCurrent();
    // field needs resize after layout change
    if (view === 'board') {
      requestAnimationFrame(() => {
        try { BoardEngine.render && BoardEngine.render(); } catch (_) {}
        window.dispatchEvent(new Event('resize'));
      });
    }
  },

  /** Panel layout helpers — do not reset board state */
  _afterPanelToggle() {
    this._syncPanelButtons();
    requestAnimationFrame(() => {
      try { BoardEngine.render && BoardEngine.render(); } catch (_) {}
      window.dispatchEvent(new Event('resize'));
    });
  },
  _syncPanelButtons() {
    const on = (sel, cond) => {
      document.querySelectorAll(sel).forEach(b => b.classList.toggle('on', !!cond));
    };
    on('[data-action="toggle-nav"]', document.body.classList.contains('bw-nav'));
    on('[data-action="toggle-props"]', document.body.classList.contains('bw-props'));
    on('[data-action="toggle-tools"]', document.body.classList.contains('bw-tools-collapsed'));
  },
  toggleNav() {
    document.body.classList.toggle('bw-nav');
    this._afterPanelToggle();
  },
  toggleProps() {
    document.body.classList.toggle('bw-props');
    this._afterPanelToggle();
  },
  toggleTools() {
    document.body.classList.toggle('bw-tools-collapsed');
    this._afterPanelToggle();
  },
  showAllPanels() {
    document.body.classList.add('bw-nav', 'bw-props');
    document.body.classList.remove('bw-tools-collapsed');
    this._afterPanelToggle();
  },

  renderCurrent() {
    const view = Store.get().ui.view;
    if (view === 'board') {
      BoardEngine.renderToolbar();
      BoardEngine.render();
      return;
    }
    const el = document.getElementById('v-' + view);
    if (!el || !Views[view]) return;
    el.innerHTML = Views[view]();
  },

  updateClock() {
    const now = new Date();
    const el = document.getElementById('clock');
    if (el) el.innerHTML = `<strong>${fmtDate(now)}</strong> · ${now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const s = Store.get();
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const nt = document.getElementById('nextTr');
    if (nt) {
      if (next) {
        const dt = new Date(next.date + 'T' + (next.time || '10:00'));
        const diff = dt - now;
        let cd = '—';
        if (diff > 0) {
          const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
          cd = h + 'г ' + m + 'хв';
        }
        nt.innerHTML = `Наступне: <strong>${sanitize(next.name)}</strong> (${cd})`;
      } else nt.innerHTML = 'Наступне: <strong>—</strong>';
    }
  },

  bindEvents() {
    // Event delegation — single listener
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-action],[data-view],[data-tool],[data-ai],[data-edit-training],[data-del-training],[data-dup-training],[data-edit-player],[data-del-player],[data-scheme],[data-load-board],[data-del-board],[data-special],[data-day],[data-view-exercise],[data-view-match],[data-del-match],[data-tpl],[data-modal-action],[data-b3-phase],[data-board-tpl],[data-b3-rot],[data-del-myex],[data-add-myex-tr],[data-load-myex-board],[data-del-diary],[data-edit-diary],[data-load-diary-board],[data-diary-filter],[data-play-anim]');
      if (!t) {
        // close search
        if (!e.target.closest('.gs')) document.getElementById('gResults')?.classList.remove('show');
        // close modal on backdrop
        if (e.target.id === 'modal') Modal.close();
        return;
      }

      const action = t.dataset.action;
      const view = t.dataset.view;

      if (view && !t.dataset.action) { e.preventDefault(); App.navigate(view); return; }
      if (t.dataset.tool) { Store.get().activeBoard.tool = t.dataset.tool; BoardEngine.renderToolbar(); return; }
      if (t.dataset.ai) {
        const map = { training: () => AIService.generateTraining(), warmup: () => AIService.generateExercise('warmup'),
          tech: () => AIService.generateExercise('tech'), tactical: () => AIService.generateExercise('tactical'),
          gk: () => AIService.generateExercise('gk'), post: () => AIService.generateTraining(),
          pre: () => AIService.generateTraining(), optimize: () => AIService.optimizeLoad(),
          balance: () => Toast.show('Баланс: тех 30% / так 30% / фіз 20% / гра 20%', 'ok'),
          micro: () => AIService.analyzeMicrocycle() };
        if (map[t.dataset.ai]) map[t.dataset.ai]();
        return;
      }

      if (action === 'new-training') return Actions.newTraining();
      if (action === 'new-myex') return Actions.newMyEx();
      if (action === 'myex-from-board') return Actions.myExFromBoard();
      if (action === 'new-diary') return Actions.newDiary();
      if (action === 'save-b3-anim') return Actions.saveB3Anim();
      if (action === 'save-anim-to-training') return Actions.saveAnimToTraining();

      if (action === 'new-player') return Actions.newPlayer();
      if (action === 'new-exercise') return Actions.newExercise();
      if (action === 'new-match') return Actions.newMatch();
      if (action === 'new-event') return Actions.newEvent();
      if (action === 'toggle-rp') return document.getElementById('rightPanel').classList.toggle('force');
      if (action === 'export') return StorageManager.exportJSON();
      if (action === 'import-trigger') return document.getElementById('importFile')?.click();
      if (action === 'print') return window.print();
      if (action === 'reset-all') return Modal.confirm('Скинути всі дані до демо?', () => { StorageManager.clear(); App.applyBranding(); App.navigate('dashboard'); Toast.show('Скинуто', 'ok'); });
      if (action === 'save-settings') return Actions.saveSettings();
      if (action === 'close-modal') return Modal.close();
      if (action === 'timer-start') return TimerEngine.start();
      if (action === 'timer-pause') return TimerEngine.pause();
      if (action === 'timer-reset') return TimerEngine.reset();
      if (action === 'timer-add') return TimerEngine.add(+t.dataset.sec || 0);
      if (action === 'extimer-start') return TimerEngine.startEx();
      if (action === 'extimer-pause') return TimerEngine.pauseEx();
      if (action === 'extimer-reset') return TimerEngine.resetEx();
      if (action === 'toggle-present') {
        document.body.classList.toggle('present-mode');
        App.navigate('board');
        Toast.show(document.body.classList.contains('present-mode') ? 'Presentation ON' : 'Presentation OFF');
        return;
      }
      if (action === 'toggle-nav') return App.toggleNav();
      if (action === 'toggle-props') return App.toggleProps();
      if (action === 'toggle-tools') return App.toggleTools();
      if (action === 'show-all-panels') return App.showAllPanels();
      if (action === 'toggle-fullscreen') return BoardEngine.toggleFullscreen();
      if (action === 'exit-fullscreen') return BoardEngine.exitFullscreen();
      if (action === 'zoom-in') return BoardEngine.setZoom(BoardEngine.camera.zoom * 1.2);
      if (action === 'zoom-out') return BoardEngine.setZoom(BoardEngine.camera.zoom / 1.2);
      if (action === 'zoom-fit') return BoardEngine.resetCamera();
      if (action === 'board-undo') return BoardEngine.undo();
      if (action === 'board-redo') return BoardEngine.redo();
      if (action === 'board-clear') return BoardEngine.clear();
      if (action === 'board-save') return BoardEngine.saveBoard();
      if (action === 'anim-play') return BoardEngine.animPlay();
      if (action === 'anim-pause') return BoardEngine.animPause();
      if (action === 'anim-stop') return BoardEngine.animStop();
      if (action === 'anim-restart') return BoardEngine.animRestart();
      if (action === 'cal-prev') { const d = new Date(Store.get().ui.calDate); d.setMonth(d.getMonth() - 1); Store.get().ui.calDate = d.toISOString().slice(0, 10); App.renderCurrent(); return; }
      if (action === 'cal-next') { const d = new Date(Store.get().ui.calDate); d.setMonth(d.getMonth() + 1); Store.get().ui.calDate = d.toISOString().slice(0, 10); App.renderCurrent(); return; }
      if (action === 'microcycle') return Actions.applyMicrocycle();
      if (action === 'export-stats') return StorageManager.exportJSON();

      if (t.dataset.editTraining) return Actions.editTraining(t.dataset.editTraining);
      if (t.dataset.delTraining) return Modal.confirm('Видалити тренування?', () => { Store.get().trainings = Store.get().trainings.filter(x => x.id !== t.dataset.delTraining); StorageManager.save(); App.renderCurrent(); Toast.show('Видалено'); });
      if (t.dataset.dupTraining) return Actions.dupTraining(t.dataset.dupTraining);
      if (t.dataset.editPlayer) return Actions.editPlayer(t.dataset.editPlayer);
      if (t.dataset.delPlayer) return Modal.confirm('Видалити гравця?', () => { Store.get().players = Store.get().players.filter(x => x.id !== t.dataset.delPlayer); StorageManager.save(); App.renderCurrent(); });
      if (t.dataset.scheme) { BoardEngine.applyScheme(t.dataset.scheme); App.navigate('board'); return; }
      if (t.dataset.boardTpl) {
        BoardEngine.applyScheme(t.dataset.boardTpl);
        App.navigate('board');
        Toast.show('Шаблон відкрито на дошці — можна змінювати', 'ok');
        return;
      }
      if (t.dataset.b3Phase) {
        BoardEngine.applyScheme(t.dataset.b3Phase);
        App.navigate('board');
        Toast.show('Фаза: ' + (t.dataset.b3Name || t.dataset.b3Phase), 'ok');
        return;
      }
      if (t.dataset.b3Rot) {
        Toast.show('Ротація: ' + t.dataset.b3Rot + ' — розставте на дошці', 'ok');
        App.navigate('board');
        return;
      }
      if (t.dataset.delMyex) {
        Modal.confirm('Видалити вправу?', () => {
          Store.get().myExercises = (Store.get().myExercises || []).filter(x => x.id !== t.dataset.delMyex);
          StorageManager.save(); App.renderCurrent();
        });
        return;
      }
      if (t.dataset.addMyexTr) {
        const ex = (Store.get().myExercises || []).find(x => x.id === t.dataset.addMyexTr);
        if (!ex) return;
        const trs = Store.get().trainings.filter(x => x.status === 'planned' || x.status === 'draft');
        if (!trs.length) {
          // create training with this exercise
          const tr = { id: uid(), name: 'Тренування: ' + ex.name, date: today(), time: '18:00', duration: ex.duration || 90, intensity: ex.intensity || 6, status: 'draft', structure: [{ id: uid(), title: ex.name, type: 'myex', duration: ex.duration || 15, intensity: ex.intensity || 6, myExId: ex.id, animationId: ex.animationId || null }], mainGoal: ex.objective || '', comment: '' };
          Store.get().trainings.push(tr);
          StorageManager.save();
          Toast.show('Створено тренування з вправою', 'ok');
          App.navigate('trainings');
        } else {
          const tr = trs[0];
          if (!tr.structure) tr.structure = [];
          tr.structure.push({ id: uid(), title: ex.name, type: 'myex', duration: ex.duration || 15, intensity: ex.intensity || 6, myExId: ex.id, animationId: ex.animationId || null });
          tr.duration = tr.structure.reduce((a, b) => a + (b.duration || 0), 0);
          StorageManager.save();
          Toast.show('Додано до: ' + tr.name, 'ok');
          App.navigate('trainings');
        }
        return;
      }
      if (t.dataset.loadMyexBoard) {
        const ex = (Store.get().myExercises || []).find(x => x.id === t.dataset.loadMyexBoard);
        if (ex && ex.board) {
          Store.get().activeBoard.objects = JSON.parse(JSON.stringify(ex.board.objects || []));
          BoardEngine.render();
          App.navigate('board');
          Toast.show('Дошка вправи завантажена');
        }
        return;
      }
      if (t.dataset.delDiary) {
        Modal.confirm('Видалити запис?', () => {
          Store.get().diary = (Store.get().diary || []).filter(x => x.id !== t.dataset.delDiary);
          StorageManager.save(); App.renderCurrent();
        });
        return;
      }
      if (t.dataset.loadDiaryBoard) {
        const d = (Store.get().diary || []).find(x => x.id === t.dataset.loadDiaryBoard);
        if (d && d.board) {
          Store.get().activeBoard.objects = JSON.parse(JSON.stringify(d.board.objects || []));
          BoardEngine.render();
          App.navigate('board');
        }
        return;
      }
      if (t.dataset.diaryFilter) {
        const f = t.dataset.diaryFilter;
        document.querySelectorAll('#diaryList .card').forEach(c => {
          if (f === 'all') c.style.display = '';
          else c.style.display = (c.dataset.diaryCat === f) ? '' : 'none';
        });
        return;
      }
      if (t.dataset.playAnim) {
        const anim = (Store.get().animations || []).find(a => a.id === t.dataset.playAnim);
        if (anim && anim.board) {
          Store.get().activeBoard.objects = JSON.parse(JSON.stringify(anim.board.objects || []));
          BoardEngine.render();
          App.navigate('board');
          BoardEngine.animPlay && BoardEngine.animPlay();
          Toast.show('Анімація: ' + (anim.name || ''), 'ok');
        }
        return;
      }

      if (t.dataset.loadBoard) return BoardEngine.loadBoard(t.dataset.loadBoard);
      if (t.dataset.delBoard) return Modal.confirm('Видалити схему?', () => { Store.get().boards = Store.get().boards.filter(x => x.id !== t.dataset.delBoard); StorageManager.save(); App.renderCurrent(); });
      if (t.dataset.special) {
        const map = {
          attack: '4-3-3', defense: '5-3-2', press: '4-2-3-1',
          setpiece: '4-4-2', transition: '4-1-4-1', highpress: '3-4-3'
        };
        BoardEngine.applyScheme(map[t.dataset.special] || '4-3-3');
        App.navigate('board');
        Toast.show('Схема: ' + (t.dataset.special || ''), 'ok');
        return;
      }
      if (t.dataset.day) { Store.get().ui.selectedDay = t.dataset.day; App.renderCurrent(); return; }
      if (t.dataset.viewExercise) return Actions.viewExercise(t.dataset.viewExercise);
      if (t.dataset.viewMatch) return Actions.viewMatch(t.dataset.viewMatch);
      if (t.dataset.delMatch) return Modal.confirm('Видалити матч?', () => { Store.get().matches = Store.get().matches.filter(x => x.id !== t.dataset.delMatch); StorageManager.save(); App.renderCurrent(); });
      if (t.dataset.tpl) return Actions.applyTemplate(t.dataset.tpl);

      if (t.dataset.modalAction === 'cancel') return Modal.close();
      if (t.dataset.modalAction === 'confirm') {
        const fn = Modal._onConfirm;
        Modal.close();
        if (fn) fn();
        return;
      }
      // form submits via modal actions with specific handlers
      if (t.dataset.modalAction === 'create-training') return Actions.createTraining();
      if (t.dataset.modalAction === 'save-training') return Actions.saveTraining(t.dataset.tid);
      if (t.dataset.modalAction === 'create-player') return Actions.createPlayer();
      if (t.dataset.modalAction === 'save-player') return Actions.savePlayer(t.dataset.pid);
      if (t.dataset.modalAction === 'create-exercise') return Actions.createExercise();
      if (t.dataset.modalAction === 'create-match') return Actions.createMatch();
      if (t.dataset.modalAction === 'create-event') return Actions.createEvent();
    });

    // Filters
    document.addEventListener('input', e => {
      if (e.target.dataset.filter === 'trainings') {
        const q = (document.getElementById('trSearch')?.value || '').toLowerCase();
        const st = document.getElementById('trStatus')?.value || '';
        let list = Store.get().trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        if (q) list = list.filter(t => t.name.toLowerCase().includes(q));
        if (st) list = list.filter(t => t.status === st);
        const el = document.getElementById('trList');
        if (el) el.innerHTML = Views._trList(list);
      }
      if (e.target.dataset.filter === 'players') {
        const q = (document.getElementById('plSearch')?.value || '').toLowerCase();
        const pos = document.getElementById('plPos')?.value || '';
        const st = document.getElementById('plSt')?.value || '';
        const gr = document.getElementById('plGr')?.value || '';
        let list = Store.get().players.slice();
        if (q) list = list.filter(p => (p.firstName + ' ' + p.lastName).toLowerCase().includes(q) || String(p.number).includes(q));
        if (pos) list = list.filter(p => p.position === pos);
        if (st) list = list.filter(p => p.status === st);
        if (gr === 'gk') list = list.filter(p => p.position === 'GK');
        else if (gr === 'def') list = list.filter(p => ['CB', 'LB', 'RB'].includes(p.position));
        else if (gr === 'mid') list = list.filter(p => ['DM', 'CM', 'AM'].includes(p.position));
        else if (gr === 'att') list = list.filter(p => ['LW', 'RW', 'ST'].includes(p.position));
        else if (gr) list = list.filter(p => p.group === gr);
        const el = document.getElementById('plTable');
        if (el) el.innerHTML = Views._plRows(list);
      }
      if (e.target.dataset.filter === 'exercises') {
        const q = (document.getElementById('exSearch')?.value || '').toLowerCase();
        const cat = document.getElementById('exCat')?.value || '';
        let list = Store.get().exercises.slice();
        if (q) list = list.filter(e => e.name.toLowerCase().includes(q));
        if (cat) list = list.filter(e => e.category === cat);
        const el = document.getElementById('exList');
        if (el) el.innerHTML = list.map(e => `<div class="ec" data-view-exercise="${e.id}"><h4>${sanitize(e.name)}</h4><div class="me">${e.category} · ${e.duration}хв · RPE ${e.intensity}</div></div>`).join('') || '<div class="es">Немає</div>';
      }
      // global search
      if (e.target.id === 'gSearch') {
        const q = e.target.value.toLowerCase().trim();
        const res = document.getElementById('gResults');
        if (!q) { res.classList.remove('show'); return; }
        const s = Store.get();
        const items = [];
        s.players.filter(p => (p.firstName + ' ' + p.lastName).toLowerCase().includes(q)).slice(0, 5)
          .forEach(p => items.push({ label: `👤 ${p.number}. ${p.firstName} ${p.lastName}`, action: () => { App.navigate('players'); } }));
        s.trainings.filter(t => t.name.toLowerCase().includes(q)).slice(0, 5)
          .forEach(t => items.push({ label: `📋 ${t.name}`, action: () => Actions.editTraining(t.id) }));
        s.exercises.filter(e => e.name.toLowerCase().includes(q)).slice(0, 5)
          .forEach(e => items.push({ label: `🏋️ ${e.name}`, action: () => Actions.viewExercise(e.id) }));
        s.matches.filter(m => (m.opponent || '').toLowerCase().includes(q)).slice(0, 3)
          .forEach(m => items.push({ label: `🏆 vs ${m.opponent}`, action: () => Actions.viewMatch(m.id) }));
        res.innerHTML = items.length ? items.map((it, i) => `<div class="gsri" data-gsi="${i}">${sanitize(it.label)}</div>`).join('') : '<div class="gsri">Нічого не знайдено</div>';
        res._items = items;
        res.classList.add('show');
      }
    });

    document.getElementById('gResults')?.addEventListener('click', e => {
      const item = e.target.closest('[data-gsi]');
      if (!item) return;
      const items = document.getElementById('gResults')._items || [];
      const it = items[+item.dataset.gsi];
      if (it) { it.action(); document.getElementById('gResults').classList.remove('show'); document.getElementById('gSearch').value = ''; }
    });

    document.getElementById('importFile')?.addEventListener('change', e => {
      if (e.target.files[0]) StorageManager.importJSON(e.target.files[0]);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (isInput(e.target)) return;
      if (e.key === 'Escape') {
        if (BoardEngine.isBoardOnly) { BoardEngine.exitFullscreen(); return; }
        Modal.close();
        Store.get().activeBoard.selectedId = null;
        BoardEngine.renderTokens();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); BoardEngine.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); BoardEngine.redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (Store.get().ui.view === 'board') BoardEngine.deleteSelected(); return; }
      if (e.key === ' ' && Store.get().ui.view === 'board') {
        e.preventDefault();
        const a = Store.get().activeBoard.anim;
        if (a.playing) BoardEngine.animPause(); else BoardEngine.animPlay();
        return;
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); StorageManager.save(); Toast.show('Збережено', 'ok'); return; }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) { Actions.newTraining(); return; }
    });

    // Prevent context menu on board for right-click delete
    document.getElementById('fieldContainer')?.addEventListener('contextmenu', e => e.preventDefault());
  }
};

/* ─── ACTIONS ───────────────────────────────────────────── */

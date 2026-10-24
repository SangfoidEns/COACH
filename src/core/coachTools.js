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

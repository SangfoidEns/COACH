/** Прив'язка тактичної дошки до сутностей (тренування, щоденник, заготовки) */
const BoardLink = {
  /** Знімок поточного activeBoard */
  snapshot() {
    try {
      const ab = Store.get().activeBoard || {};
      return {
        objects: JSON.parse(JSON.stringify(ab.objects || [])),
        fieldView: ab.fieldView || 'full',
        camera: (typeof BoardEngine !== 'undefined' && BoardEngine.camera)
          ? Object.assign({}, BoardEngine.camera) : null,
        capturedAt: new Date().toISOString()
      };
    } catch (e) {
      console.warn('[BoardLink] snapshot', e);
      return { objects: [], fieldView: 'full', capturedAt: new Date().toISOString() };
    }
  },

  /** Відновити знімок у activeBoard і відкрити дошку */
  openSnapshot(snap, reason) {
    if (!snap) {
      if (typeof Toast !== 'undefined') Toast.show('Немає прикріпленої дошки', 'warn');
      return false;
    }
    try {
      const s = Store.get();
      if (!s.activeBoard) s.activeBoard = { objects: [], fieldView: 'full' };
      s.activeBoard.objects = JSON.parse(JSON.stringify(snap.objects || []));
      if (snap.fieldView) s.activeBoard.fieldView = snap.fieldView;
      if (snap.camera && typeof BoardEngine !== 'undefined') {
        BoardEngine.camera = Object.assign({}, BoardEngine.camera || {}, snap.camera);
      }
      try {
        if (typeof BoardEngine !== 'undefined') {
          BoardEngine._migratedLeft = false;
          if (BoardEngine.migrateLeftEdgeToBench) BoardEngine.migrateLeftEdgeToBench();
          if (BoardEngine.pushHistory) BoardEngine.pushHistory();
          if (BoardEngine.render) BoardEngine.render();
        }
      } catch (_) {}
      if (typeof App !== 'undefined') {
        App.allowBoardOnce(reason || 'board-link');
        App.navigate('board');
      }
      try { TelegramManager.haptic && TelegramManager.haptic('medium'); } catch (_) {}
      return true;
    } catch (e) {
      console.error('[BoardLink] open', e);
      return false;
    }
  },

  attachTo(entity) {
    if (!entity) return null;
    entity.board = this.snapshot();
    entity.boardAttachedAt = new Date().toISOString();
    return entity.board;
  },

  hasBoard(entity) {
    return !!(entity && entity.board && Array.isArray(entity.board.objects));
  }
};

if (typeof window !== 'undefined') window.BoardLink = BoardLink;

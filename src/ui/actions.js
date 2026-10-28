/** Extracted module: src/ui/actions.js lines 2395-3022 — DO NOT rewrite business logic */
const Actions = {

  newMyEx() {
    Modal.open('Нова вправа', `
      <div class="fg">
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_name','Назва'):'Назва')}</label><input id="mxN" placeholder="3v2 Build-up"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_category','Категорія'):'Категорія')}</label>
          <select id="mxCat"><option>build-up</option><option>pressing</option><option>transition</option>
          <option>finishing</option><option>possession</option><option>defending</option><option>set-piece</option>
          <option>back-three</option><option>wing-back</option></select>
        </div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_min','Хв'):'Хв')}</label><input type="number" id="mxD" value="15"></div>
        <div class="fgr"><label>RPE</label><input type="number" id="mxI" value="6" min="1" max="10"></div>
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_goal','Мета'):'Мета')}</label><input id="mxO" placeholder="Progress through first line"></div>
        <div class="fgr full"><label>Coaching points</label><textarea id="mxCP"></textarea></div>
        <div class="fgr full"><label>Tags (кома)</label><input id="mxT" placeholder="3defenders, build-up"></div>
        <div class="fgr full"><label><input type="checkbox" id="mxBoard" checked> ${(typeof I18n!=='undefined'?I18n.t('save_board_with','Зберегти поточну дошку'):'Зберегти поточну дошку')}</label></div>
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Створити', cls: 'btn-p', action: 'create-myex' }
    ]);
  },
  createMyEx() {
    const name = document.getElementById('mxN')?.value?.trim();
    if (!name) { Toast.show((typeof I18n!=='undefined'?I18n.t('toast_need_name','Вкажіть назву'):'Вкажіть назву'), 'warn'); return; }
    const useBoard = document.getElementById('mxBoard')?.checked;
    let board = null;
    if (useBoard) {
      board = (typeof BoardLink !== 'undefined')
        ? BoardLink.snapshot()
        : { objects: JSON.parse(JSON.stringify((Store.get().activeBoard || {}).objects || [])) };
    }
    let animId = null;
    if (board) {
      animId = uid();
      Store.get().animations = Store.get().animations || [];
      Store.get().animations.push({ id: animId, name: name + ' anim', board, createdAt: new Date().toISOString() });
    }
    Store.get().myExercises = Store.get().myExercises || [];
    Store.get().myExercises.push({
      id: uid(), name,
      category: document.getElementById('mxCat')?.value,
      duration: +document.getElementById('mxD')?.value || 15,
      intensity: +document.getElementById('mxI')?.value || 6,
      objective: document.getElementById('mxO')?.value || '',
      coachingPoints: document.getElementById('mxCP')?.value || '',
      tags: (document.getElementById('mxT')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      board, animationId: animId,
      createdAt: new Date().toISOString()
    });
    StorageManager.save(); Modal.close();
    Toast.show((typeof I18n!=='undefined'?I18n.t('toast_ex_saved','Вправу збережено'):'Вправу збережено'), 'ok');
    App.navigate('myex');
  },
  myExFromBoard() {
    this.newMyEx();
  },
  newDiary(opts) {
    opts = opts || {};
    const forceBoard = !!opts.withBoard;
    const objs = ((Store.get().activeBoard || {}).objects || []);
    const boardCount = objs.length;
    const players = Store.get().players.map(p => `<option value="${p.id}">${p.number}. ${p.firstName} ${p.lastName}</option>`).join('');
    const boardHint = boardCount
      ? ('На дошці зараз <strong>' + boardCount + '</strong> об\'єктів. Можна зберегти знімок разом із записом.')
      : 'Дошка порожня — можна зберегти запис без схеми або спочатку намалювати тактику.';
    Modal.open(forceBoard ? (typeof I18n!=='undefined'?I18n.t('save_board_diary','Зберегти дошку в щоденник'):'Зберегти дошку в щоденник') : (typeof I18n!=='undefined'?I18n.t('diary_entry','Запис у щоденник'):'Запис у щоденник'), `
      <div class="fg">
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_title','Заголовок'):'Заголовок')}</label><input id="dyT" placeholder="${forceBoard ? 'Тактика / ідея з дошки' : 'Проблема проти high press'}" value="${forceBoard ? 'Схема з дошки · ' + new Date().toLocaleString('uk-UA') : ''}"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_category','Категорія'):'Категорія')}</label>
          <select id="dyC"><option ${forceBoard ? 'selected' : ''}>Tactical Idea</option><option>Training Reflection</option>
          <option>Match Reflection</option><option>Player Observation</option><option>Team Observation</option>
          <option>Problem</option><option>Solution</option><option>Goal</option><option>Meeting</option><option>Personal Note</option></select>
        </div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_mood','Настрій'):'Настрій')}</label><select id="dyM"><option></option><option>😊</option><option>😐</option><option>😤</option><option selected>💡</option></select></div>
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_text','Текст'):'Текст')}</label><textarea id="dyX" rows="4" placeholder="Короткий коментар до схеми..."></textarea></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_player','Гравець'):'Гравець')}</label><select id="dyP"><option value="">—</option>${players}</select></div>
        <div class="fgr full"><label>Tags</label><input id="dyTags" placeholder="3defenders, pressing"></div>
        <div class="fgr full" style="background:rgba(34,197,94,0.08);padding:10px;border-radius:10px;border:1px solid rgba(34,197,94,0.25)">
          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer">
            <input type="checkbox" id="dyBoard" ${forceBoard || boardCount > 0 ? 'checked' : ''} style="margin-top:3px">
            <span><strong>${(typeof I18n!=='undefined'?I18n.t('save_board_with_entry','Зберегти дошку разом із записом'):'Зберегти дошку разом із записом')}</strong><br>
            <span class="note-sm">${boardHint}</span></span>
          </label>
        </div>
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: (typeof I18n!=='undefined'?I18n.t('save_diary','Зберегти в щоденник'):'Зберегти в щоденник'), cls: 'btn-p', action: 'create-diary' }
    ]);
  },

  /** Швидке збереження поточної дошки як запис щоденника (з панелі дошки) */
  saveBoardToDiary() {
    this.newDiary({ withBoard: true });
  },
  createDiary() {
    try {
      const title = document.getElementById('dyT')?.value?.trim() || 'Запис';
      const attach = !!document.getElementById('dyBoard')?.checked;
      let board = null;
      if (attach && typeof BoardLink !== 'undefined') board = BoardLink.snapshot();
      else if (attach) {
        board = { objects: JSON.parse(JSON.stringify((Store.get().activeBoard || {}).objects || [])) };
      }
      Store.get().diary = Store.get().diary || [];
      Store.get().diary.push({
        id: uid(),
        title,
        category: document.getElementById('dyC')?.value || 'Personal Note',
        mood: document.getElementById('dyM')?.value || '',
        text: document.getElementById('dyX')?.value || '',
        playerId: document.getElementById('dyP')?.value || '',
        tags: (document.getElementById('dyTags')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
        board,
        date: today(),
        createdAt: new Date().toISOString()
      });
      StorageManager.save();
      Modal.close();
      try { TelegramManager.hapticSuccess && TelegramManager.hapticSuccess(); } catch (_) {}
      Toast.show(attach ? 'Запис збережено + дошка' : 'Запис збережено', 'ok');
      App.navigate('diary');
    } catch (e) {
      console.error('[createDiary]', e);
      Toast.show((typeof I18n!=='undefined'?I18n.t('toast_diary_err','Помилка'):'Помилка'), 'error');
    }
  },

  editDiary(id) {
    const d = (Store.get().diary || []).find(x => x.id === id);
    if (!d) return;
    const players = Store.get().players.map(p =>
      `<option value="${p.id}" ${p.id === d.playerId ? 'selected' : ''}>${p.number}. ${p.firstName} ${p.lastName}</option>`
    ).join('');
    const cats = ['Tactical Idea','Training Reflection','Match Reflection','Player Observation','Team Observation','Problem','Solution','Goal','Meeting','Personal Note'];
    Modal.open('Редагування запису', `
      <div class="fg">
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_title','Заголовок'):'Заголовок')}</label><input id="dyT" value="${sanitize(d.title || '')}"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_category','Категорія'):'Категорія')}</label>
          <select id="dyC">${cats.map(c => `<option ${d.category===c?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_mood','Настрій'):'Настрій')}</label>
          <select id="dyM"><option></option>
            ${['😊','😐','😤','💡'].map(m => `<option ${d.mood===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_text','Текст'):'Текст')}</label><textarea id="dyX" rows="5">${sanitize(d.text || '')}</textarea></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_player','Гравець'):'Гравець')}</label><select id="dyP"><option value="">—</option>${players}</select></div>
        <div class="fgr full"><label>Tags</label><input id="dyTags" value="${sanitize((d.tags||[]).join(', '))}"></div>
        <div class="fgr full"><label><input type="checkbox" id="dyBoard"> ${d.board ? 'Оновити дошку з поточної' : 'Прикріпити поточну дошку'}</label></div>
        ${d.board ? '<p class="note-sm">У запису вже є прикріплена дошка. Відкрити: кнопка ⚽ у списку.</p>' : ''}
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: d.board ? 'Відкрити дошку' : '—', cls: 'btn-s', action: d.board ? 'open-diary-board' : 'cancel' },
      { label: 'Зберегти', cls: 'btn-p', action: 'save-diary' }
    ]);
    const saveBtn = document.querySelector('[data-modal-action="save-diary"]');
    if (saveBtn) saveBtn.dataset.did = id;
    const openBtn = document.querySelector('[data-modal-action="open-diary-board"]');
    if (openBtn) openBtn.dataset.did = id;
  },

  saveDiary(id) {
    try {
      const d = (Store.get().diary || []).find(x => x.id === id);
      if (!d) return;
      d.title = document.getElementById('dyT')?.value?.trim() || d.title;
      d.category = document.getElementById('dyC')?.value || d.category;
      d.mood = document.getElementById('dyM')?.value || '';
      d.text = document.getElementById('dyX')?.value || '';
      d.playerId = document.getElementById('dyP')?.value || '';
      d.tags = (document.getElementById('dyTags')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      d.updatedAt = new Date().toISOString();
      if (document.getElementById('dyBoard')?.checked) {
        d.board = (typeof BoardLink !== 'undefined') ? BoardLink.snapshot() : {
          objects: JSON.parse(JSON.stringify((Store.get().activeBoard || {}).objects || []))
        };
        d.boardObjCount = (d.board && d.board.objects) ? d.board.objects.length : 0;
      }
      StorageManager.save();
      Modal.close();
      try { TelegramManager.hapticSuccess && TelegramManager.hapticSuccess(); } catch (_) {}
      Toast.show('Запис оновлено', 'ok');
      App.renderCurrent();
    } catch (e) {
      console.error('[saveDiary]', e);
      Toast.show('Помилка збереження', 'error');
    }
  },

  openDiaryBoard(id) {
    const d = (Store.get().diary || []).find(x => x.id === id);
    if (!d || !d.board) {
      Toast.show('Немає прикріпленої дошки', 'warn');
      return;
    }
    Modal.close();
    if (typeof BoardLink !== 'undefined') BoardLink.openSnapshot(d.board, 'diary-board');
    else {
      Store.get().activeBoard.objects = JSON.parse(JSON.stringify(d.board.objects || []));
      App.allowBoardOnce('diary-board');
      App.navigate('board');
    }
  },

  openTrainingBoard(id) {
    const t = (Store.get().trainings || []).find(x => x.id === id);
    Modal.close();
    if (t && t.board && typeof BoardLink !== 'undefined') {
      BoardLink.openSnapshot(t.board, 'training-board');
      Toast.show('Дошка тренування відкрита', 'ok');
      return;
    }
    // немає знімка — відкрити поточну дошку і запам'ятати контекст
    Store.get().ui = Store.get().ui || {};
    Store.get().ui.boardContext = { type: 'training', id: id };
    App.allowBoardOnce('training-board');
    App.navigate('board');
    Toast.show('Дошка відкрита. Збережіть схему або «Прикріпити до тренування» в меню.', 'ok');
  },

  attachBoardToTraining(id) {
    const t = (Store.get().trainings || []).find(x => x.id === id);
    if (!t) return;
    if (typeof BoardLink !== 'undefined') BoardLink.attachTo(t);
    else t.board = { objects: JSON.parse(JSON.stringify((Store.get().activeBoard || {}).objects || [])) };
    StorageManager.save();
    try { TelegramManager.hapticSuccess && TelegramManager.hapticSuccess(); } catch (_) {}
    Toast.show('Дошку прикріплено до «' + (t.name || '') + '»', 'ok');
  },

  saveB3Anim() {
    const name = prompt('Назва анімації/фази:', '3-2 Build-up');
    if (!name) return;
    const board = { objects: JSON.parse(JSON.stringify(Store.get().activeBoard.objects)) };
    const id = uid();
    Store.get().animations = Store.get().animations || [];
    Store.get().animations.push({ id, name, board, tags: ['3defenders'], createdAt: new Date().toISOString() });
    StorageManager.save();
    Toast.show('Анімацію збережено', 'ok');
  },
  saveAnimToTraining() {
    const anims = Store.get().animations || [];
    if (!anims.length) {
      // save current board as anim first
      const board = { objects: JSON.parse(JSON.stringify(Store.get().activeBoard.objects)) };
      const id = uid();
      const name = prompt('Назва анімації:', 'Board anim') || 'Board anim';
      Store.get().animations = Store.get().animations || [];
      Store.get().animations.push({ id, name, board, createdAt: new Date().toISOString() });
      anims.push({ id, name, board });
    }
    const last = (Store.get().animations || []).slice(-1)[0];
    const trs = Store.get().trainings;
    if (!trs.length) {
      Store.get().trainings.push({
        id: uid(), name: 'Тренування з анімацією', date: today(), time: '18:00', duration: 90,
        intensity: 6, status: 'draft',
        structure: [{ id: uid(), title: last.name, type: 'animation', duration: 10, intensity: 5, animationId: last.id }],
        mainGoal: '', comment: ''
      });
      StorageManager.save();
      Toast.show('Створено тренування з анімацією', 'ok');
      App.navigate('trainings');
      return;
    }
    const tr = trs[trs.length - 1];
    if (!tr.structure) tr.structure = [];
    tr.structure.push({ id: uid(), title: last.name, type: 'animation', duration: 10, intensity: 5, animationId: last.id });
    StorageManager.save();
    Toast.show('Анімацію додано до: ' + tr.name, 'ok');
    App.navigate('trainings');
  },

  newTraining() {
    const s = Store.get().settings;
    Modal.open('Нове тренування', `
      <div class="fg">
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_name','Назва'):'Назва')}</label><input id="tName" value="Тренування ${fmtDate(new Date())}"></div>
        <div class="fgr"><label>Дата</label><input type="date" id="tDate" value="${today()}"></div>
        <div class="fgr"><label>Час</label><input type="time" id="tTime" value="10:00"></div>
        <div class="fgr"><label>Тривалість (хв)</label><input type="number" id="tDur" value="${s.defaultDuration}"></div>
        <div class="fgr"><label>Місце</label><input id="tPlace" value="Тренувальна база"></div>
        <div class="fgr"><label>Покриття</label><select id="tSurf"><option>Газон</option><option>Штучне</option><option>Зал</option></select></div>
        <div class="fgr"><label>Гравців</label><input type="number" id="tPl" value="16"></div>
        <div class="fgr"><label>Інтенсивність (RPE 1-10)</label><input type="number" id="tInt" value="${s.defaultIntensity}" min="1" max="10"></div>
        <div class="fgr full"><label>Основна мета</label><input id="tGoal" value="Техніко-тактична підготовка"></div>
        <div class="fgr"><label>Фізична</label><input id="tPhys"></div>
        <div class="fgr"><label>Тактична</label><input id="tTact"></div>
        <div class="fgr"><label>Технічна</label><input id="tTech"></div>
        <div class="fgr"><label>Психологічна</label><input id="tPsych"></div>
        <div class="fgr full"><label>Коментар</label><textarea id="tCom"></textarea></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_status','Статус'):'Статус')}</label><select id="tSt"><option value="draft">Чернетка</option><option value="planned">Заплановане</option><option value="pinned">Закріплене</option></select></div>
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Зберегти', cls: 'btn-p', action: 'create-training' }
    ]);
  },

  createTraining() {
    const name = document.getElementById('tName')?.value?.trim();
    if (!name) { Toast.show((typeof I18n!=='undefined'?I18n.t('toast_need_name','Вкажіть назву'):'Вкажіть назву'), 'warn'); return; }
    const structure = [
      { id: uid(), title: 'Розминка', type: 'warmup', duration: 15, intensity: 3 },
      { id: uid(), title: 'Активація', type: 'activation', duration: 10, intensity: 4 },
      { id: uid(), title: 'Технічний блок', type: 'tech', duration: 20, intensity: 6 },
      { id: uid(), title: 'Тактичний блок', type: 'tactical', duration: 20, intensity: 7 },
      { id: uid(), title: 'Ігровий блок', type: 'game', duration: 15, intensity: 8 },
      { id: uid(), title: 'Заминка / Розтяжка', type: 'cooldown', duration: 10, intensity: 2 }
    ];
    const total = structure.reduce((a, b) => a + b.duration, 0);
    const t = {
      id: uid(), name, date: document.getElementById('tDate')?.value || today(),
      time: document.getElementById('tTime')?.value || '10:00',
      duration: total, place: document.getElementById('tPlace')?.value,
      surface: document.getElementById('tSurf')?.value, playersCount: +document.getElementById('tPl')?.value || 16,
      intensity: +document.getElementById('tInt')?.value || 6,
      mainGoal: document.getElementById('tGoal')?.value, physGoal: document.getElementById('tPhys')?.value,
      tactGoal: document.getElementById('tTact')?.value, techGoal: document.getElementById('tTech')?.value,
      psychGoal: document.getElementById('tPsych')?.value, comment: document.getElementById('tCom')?.value,
      status: document.getElementById('tSt')?.value || 'draft', structure, createdAt: new Date().toISOString()
    };
    Store.get().trainings.push(t);
    Store.get().calendar.push({ id: uid(), type: 'TRAINING', title: t.name, date: t.date, time: t.time, trainingId: t.id });
    StorageManager.save();
    Modal.close();
    Toast.show('Тренування створено', 'ok');
    App.navigate('trainings');
  },

  editTraining(id) {
    const t = Store.get().trainings.find(x => x.id === id);
    if (!t) return;
    const structHtml = (t.structure || []).map((b, i) => `
      <div class="si" data-idx="${i}">
        <span class="dh">⠿</span>
        <span class="bn">${sanitize(b.title || b.name)}</span>
        <span class="btm">${b.duration} хв</span>
        <div class="ba2">
          <button class="btn btn-s btn-sm" data-edit-block="${id}:${i}">✎</button>
          <button class="btn btn-s btn-sm" data-dup-block="${id}:${i}">⧉</button>
          <button class="btn btn-d btn-sm" data-del-block="${id}:${i}">✕</button>
        </div>
      </div>`).join('');
    const total = (t.structure || []).reduce((a, b) => a + (b.duration || 0), 0);
    Modal.open('Редагування тренування', `
      <div class="fg">
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_name','Назва'):'Назва')}</label><input id="teName" value="${sanitize(t.name)}"></div>
        <div class="fgr"><label>Дата</label><input type="date" id="teDate" value="${t.date}"></div>
        <div class="fgr"><label>Час</label><input type="time" id="teTime" value="${t.time || ''}"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_status','Статус'):'Статус')}</label><select id="teSt">
          ${['draft','planned','done','pinned','cancelled'].map(s => `<option value="${s}" ${t.status===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="fgr"><label>RPE</label><input type="number" id="teInt" value="${t.intensity || 6}" min="1" max="10"></div>
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_goal','Мета'):'Мета')}</label><input id="teGoal" value="${sanitize(t.mainGoal || '')}"></div>
        <div class="fgr full"><label>Коментар</label><textarea id="teCom">${sanitize(t.comment || '')}</textarea></div>
        <div class="fgr full"><label><input type="checkbox" id="teAttachBoard"> ${t.board ? 'Оновити прикріплену дошку з поточної' : 'Прикріпити поточну дошку до тренування'}</label></div>
        ${t.board ? '<p class="note-sm">До тренування вже прикріплена дошка (' + (t.board.objects||[]).length + ' об\'єктів).</p>' : ''}
      </div>
      <div class="ct" style="margin-top:12px">Структура (разом: <strong id="totalDur">${total}</strong> хв)</div>
      <div id="structList">${structHtml}</div>
      <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
        ${['Розминка:10','Активація:8','Техніка:15','Тактика:15','Фізика:10','Гра:15','Пауза:5','Вода:3','Пояснення:5','Заминка:10'].map(x => {
          const [n, d] = x.split(':');
          return `<button class="btn btn-s btn-sm" data-add-block="${id}:${n}:${d}">+ ${n}</button>`;
        }).join('')}
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Відвідування', cls: 'btn-s', action: 'open-attendance' },
      { label: 'На дошку', cls: 'btn-s', action: 'open-training-board' },
      { label: 'Зберегти', cls: 'btn-p', action: 'save-training' }
    ]);
    // attach tid
    const saveBtn = document.querySelector('[data-modal-action="save-training"]');
    if (saveBtn) saveBtn.dataset.tid = id;
    const attBtn = document.querySelector('[data-modal-action="open-attendance"]');
    if (attBtn) attBtn.dataset.tid = id;
    const boardBtn = document.querySelector('[data-modal-action="open-training-board"]');
    if (boardBtn) boardBtn.dataset.tid = id;

    // block actions via delegation on modal
    document.getElementById('modalBody').onclick = e => {
      e.stopPropagation();
      const ab = e.target.closest('[data-add-block]');
      if (ab) {
        const [tid, name, dur] = ab.dataset.addBlock.split(':');
        const tr = Store.get().trainings.find(x => x.id === tid);
        if (!tr) return;
        if (!tr.structure) tr.structure = [];
        tr.structure.push({ id: uid(), title: name, type: 'custom', duration: +dur, intensity: 5 });
        tr.duration = tr.structure.reduce((a, b) => a + b.duration, 0);
        StorageManager.save();
        Actions.editTraining(tid);
        return;
      }
      const db = e.target.closest('[data-del-block]');
      if (db) {
        const [tid, idx] = db.dataset.delBlock.split(':');
        const tr = Store.get().trainings.find(x => x.id === tid);
        if (tr?.structure) { tr.structure.splice(+idx, 1); tr.duration = tr.structure.reduce((a, b) => a + b.duration, 0); StorageManager.save(); Actions.editTraining(tid); }
        return;
      }
      const dup = e.target.closest('[data-dup-block]');
      if (dup) {
        const [tid, idx] = dup.dataset.dupBlock.split(':');
        const tr = Store.get().trainings.find(x => x.id === tid);
        if (tr?.structure) {
          const c = Object.assign({}, tr.structure[+idx], { id: uid() });
          tr.structure.splice(+idx + 1, 0, c);
          tr.duration = tr.structure.reduce((a, b) => a + b.duration, 0);
          StorageManager.save(); Actions.editTraining(tid);
        }
        return;
      }
      const eb = e.target.closest('[data-edit-block]');
      if (eb) {
        const [tid, idx] = eb.dataset.editBlock.split(':');
        const tr = Store.get().trainings.find(x => x.id === tid);
        const block = tr?.structure?.[+idx];
        if (!block) return;
        Modal.prompt('Назва блоку', block.title || block.name, name => {
          if (name === null) return;
          Modal.prompt('Тривалість (хв)', String(block.duration), dur => {
            if (dur === null) return;
            block.title = name;
            block.duration = +dur || 5;
            tr.duration = tr.structure.reduce((a, b) => a + b.duration, 0);
            StorageManager.save();
            Actions.editTraining(tid);
          });
        });
      }
    };
  },

  saveTraining(id) {
    const t = Store.get().trainings.find(x => x.id === id);
    if (!t) return;
    t.name = document.getElementById('teName')?.value || t.name;
    t.date = document.getElementById('teDate')?.value || t.date;
    t.time = document.getElementById('teTime')?.value;
    t.status = document.getElementById('teSt')?.value;
    t.intensity = +document.getElementById('teInt')?.value || t.intensity;
    t.mainGoal = document.getElementById('teGoal')?.value;
    t.comment = document.getElementById('teCom')?.value;
    t.duration = (t.structure || []).reduce((a, b) => a + (b.duration || 0), 0);
    if (document.getElementById('teAttachBoard')?.checked) {
      if (typeof BoardLink !== 'undefined') BoardLink.attachTo(t);
      else t.board = { objects: JSON.parse(JSON.stringify((Store.get().activeBoard || {}).objects || [])) };
    }
    StorageManager.save();
    Modal.close();
    Toast.show(typeof t==='function'?t('save'):'Збережено', 'ok');
    App.renderCurrent();
  },

  cancelTraining(id) {
    const t = Store.get().trainings.find(x => x.id === id);
    if (!t) return;
    Modal.confirm('Скасувати тренування «' + (t.name || '') + '»? Воно не враховуватиметься в аналітиці.', () => {
      t.status = 'cancelled';
      t.cancelledAt = new Date().toISOString();
      StorageManager.save();
      Toast.show('Тренування скасовано', 'ok');
      App.renderCurrent();
    });
  },

  dupTraining(id) {
    const t = Store.get().trainings.find(x => x.id === id);
    if (!t) return;
    const c = JSON.parse(JSON.stringify(t));
    c.id = uid(); c.name = t.name + ' (копія)'; c.status = 'draft';
    if (c.structure) c.structure.forEach(b => b.id = uid());
    Store.get().trainings.push(c);
    StorageManager.save();
    Toast.show('Скопійовано', 'ok');
    App.renderCurrent();
  },

  newPlayer() {
    Modal.open('Новий гравець', `
      <div class="fg">
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_first','Ім’я'):'Ім\u2019я')}</label><input id="plF"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_last','Прізвище'):'Прізвище')}</label><input id="plL"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_number','Номер'):'Номер')}</label><input type="number" id="plN" min="1" max="99"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_position','Позиція'):'Позиція')}</label><select id="plP">${['GK','CB','LB','RB','DM','CM','AM','LW','RW','ST'].map(p=>`<option>${p}</option>`).join('')}</select></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_age','Вік'):'Вік')}</label><input type="number" id="plA" value="24"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_status','Статус'):'Статус')}</label><select id="plS">
          <option value="available">${(typeof I18n!=='undefined'?I18n.t('healthy','Здоровий'):'Здоровий')}</option>
          <option value="injured">${(typeof I18n!=='undefined'?I18n.t('status_injured','Травмований'):'Травмований')}</option>
          <option value="rehab">${(typeof I18n!=='undefined'?I18n.t('status_rehab','Відновлення'):'Відновлення')}</option>
          <option value="suspended">Дискваліфікація</option>
          <option value="unavailable">Недоступний</option>
        </select></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_condition','Стан %'):'Стан %')}</label><input type="number" id="plC" value="90" min="0" max="100"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_readiness','Готовність %'):'Готовність %')}</label><input type="number" id="plR" value="95" min="0" max="100"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_group','Група'):'Група')}</label><select id="plG"><option value="main">${(typeof I18n!=='undefined'?I18n.t('group_main','Основний'):'Основний')}</option><option value="reserve">${(typeof I18n!=='undefined'?I18n.t('group_reserve','Резерв'):'Резерв')}</option><option value="gk">${(typeof I18n!=='undefined'?I18n.t('group_gk','Воротарі'):'Воротарі')}</option></select></div>
        <div class="fgr full"><label class="chk-label"><input type="checkbox" id="plCap"> ${(typeof I18n!=='undefined'?I18n.t('label_captain','Капітан команди'):'Капітан команди')}</label></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_birth','Дата народження'):'Дата народження')}</label><input type="date" id="plBirth"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_telegram','Telegram'):'Telegram')}</label><input id="plTg" placeholder="@username" autocomplete="off"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_phone','Телефон'):'Телефон')}</label><input id="plPhone" type="tel" placeholder="+49..." autocomplete="off"></div>
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_notes','Примітки'):'Примітки')}</label><textarea id="plNo"></textarea></div>
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Додати', cls: 'btn-p', action: 'create-player' }
    ]);
  },

  createPlayer() {
    const firstName = document.getElementById('plF')?.value?.trim();
    const lastName = document.getElementById('plL')?.value?.trim();
    if (!firstName && !lastName) { Toast.show('Вкажіть ім\'я', 'warn'); return; }
    const st = document.getElementById('plS')?.value || 'available';
    const status = st === 'healthy' ? 'available' : (st === 'recovery' ? 'rehab' : st);
    const isCaptain = !!document.getElementById('plCap')?.checked;
    if (isCaptain) Store.get().players.forEach(x => { x.isCaptain = false; });
    Store.get().players.push({
      id: uid(), firstName, lastName,
      number: +document.getElementById('plN')?.value || 99,
      position: document.getElementById('plP')?.value || 'CM',
      secondaryPositions: [], age: +document.getElementById('plA')?.value || 20,
      status,
      healthStatus: status,
      isCaptain,
      condition: +document.getElementById('plC')?.value || 90,
      readiness: +document.getElementById('plR')?.value || 90,
      load: 0, notes: document.getElementById('plNo')?.value || '',
      group: document.getElementById('plG')?.value || 'main', tags: [],
      telegramUsername: (document.getElementById('plTg')?.value || '').replace(/^@/, '').trim(),
      phone: (document.getElementById('plPhone')?.value || '').trim(),
      birthDate: document.getElementById('plBirth')?.value || ''
    });
    StorageManager.save();
    Modal.close();
    Toast.show((typeof I18n!=='undefined'?I18n.t('toast_player_added','Гравця додано'):'Гравця додано'), 'ok');
    App.renderCurrent();
  },

  editPlayer(id) {
    const p = Store.get().players.find(x => x.id === id);
    if (!p) return;
    const st = p.status || 'available';
    const stHealthy = (st === 'available' || st === 'healthy');
    const stInj = (st === 'injured');
    const stRehab = (st === 'rehab' || st === 'recovery');
    Modal.open('Редагування гравця', `
      <div class="fg">
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_first','Ім’я'):'Ім\u2019я')}</label><input id="peF" value="${sanitize(p.firstName)}"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_last','Прізвище'):'Прізвище')}</label><input id="peL" value="${sanitize(p.lastName)}"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_number','Номер'):'Номер')}</label><input type="number" id="peN" value="${p.number}"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_position','Позиція'):'Позиція')}</label><select id="peP">${['GK','CB','LB','RB','DM','CM','AM','LW','RW','ST'].map(pos=>`<option ${p.position===pos?'selected':''}>${pos}</option>`).join('')}</select></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_age','Вік'):'Вік')}</label><input type="number" id="peA" value="${p.age}"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_health','Статус здоров’я'):'Статус здоров\u2019я')}</label><select id="peS">
          <option value="available" ${stHealthy?'selected':''}>Здоровий</option>
          <option value="injured" ${stInj?'selected':''}>Травмований</option>
          <option value="rehab" ${stRehab?'selected':''}>Відновлення</option>
          <option value="suspended" ${st==='suspended'?'selected':''}>Дискваліфікація</option>
          <option value="unavailable" ${st==='unavailable'?'selected':''}>Недоступний</option>
        </select></div>
        <div class="fgr full"><label class="chk-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="peCap" ${p.isCaptain?'checked':''} style="width:18px;height:18px">
          <span><strong>Капітан команди (C)</strong></span>
        </label></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_condition','Стан %'):'Стан %')}</label><input type="number" id="peC" value="${p.condition}"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_readiness','Готовність %'):'Готовність %')}</label><input type="number" id="peR" value="${p.readiness}"></div>
        <div class="fgr"><label>Load (0-10)</label><input type="number" id="peLoad" value="${p.load||0}" min="0" max="10"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_group','Група'):'Група')}</label><select id="peG">
          <option value="main" ${p.group==='main'?'selected':''}>Основний</option>
          <option value="reserve" ${p.group==='reserve'?'selected':''}>Резерв</option>
          <option value="gk" ${p.group==='gk'?'selected':''}>Воротарі</option>
        </select></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_birth','Дата народження'):'Дата народження')}</label><input type="date" id="peBirth" value="${sanitize(p.birthDate||'')}"></div>
        <div class="fgr full"><label>Фото гравця (URL або data)</label>
          <input id="pePhoto" type="url" placeholder="https://… або завантажте файл нижче" value="${sanitize(p.photoUrl||'')}">
          <input id="pePhotoFile" type="file" accept="image/*" style="margin-top:6px;font-size:12px">
          ${p.photoUrl ? '<img src="'+sanitize(p.photoUrl)+'" alt="" style="max-height:64px;margin-top:6px;border-radius:8px">' : ''}
        </div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_telegram','Telegram'):'Telegram')}</label><input id="peTg" value="${sanitize(p.telegramUsername||'')}" placeholder="@username" autocomplete="off"></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_phone','Телефон'):'Телефон')}</label><input id="pePhone" type="tel" value="${sanitize(p.phone||'')}" placeholder="+49..." autocomplete="off"></div>
        <div class="fgr full"><label>Примітки / Індивідуальна програма</label><textarea id="peNo">${sanitize(p.notes||'')}</textarea></div>
        <p class="note-sm" style="grid-column:1/-1;margin:0">Telegram-нік потрібен для майбутнього входу гравця / персоналу в Mini App.</p>
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Зберегти', cls: 'btn-p', action: 'save-player' }
    ]);
    const btn = document.querySelector('[data-modal-action="save-player"]');
    if (btn) btn.dataset.pid = id;
  },

  savePlayer(id) {
    const p = Store.get().players.find(x => x.id === id);
    if (!p) return;
    p.firstName = document.getElementById('peF')?.value || p.firstName;
    p.lastName = document.getElementById('peL')?.value || p.lastName;
    p.number = +document.getElementById('peN')?.value || p.number;
    p.position = document.getElementById('peP')?.value || p.position;
    p.age = +document.getElementById('peA')?.value || p.age;
    p.status = document.getElementById('peS')?.value || p.status;
    if (p.status === 'healthy') p.status = 'available';
    if (p.status === 'recovery') p.status = 'rehab';
    p.condition = +document.getElementById('peC')?.value ?? p.condition;
    p.readiness = +document.getElementById('peR')?.value ?? p.readiness;
    p.load = +document.getElementById('peLoad')?.value ?? p.load;
    p.group = document.getElementById('peG')?.value || p.group;
    p.notes = document.getElementById('peNo')?.value || '';
    p.telegramUsername = (document.getElementById('peTg')?.value || '').replace(/^@/, '').trim();
    p.phone = (document.getElementById('pePhone')?.value || '').trim();
    const bd = document.getElementById('peBirth')?.value;
    if (bd !== undefined) p.birthDate = bd || '';

    const pePhotoVal = document.getElementById('pePhoto')?.value?.trim();
    if (pePhotoVal) p.photoUrl = pePhotoVal;
    const wantCap = !!document.getElementById('peCap')?.checked;
    if (wantCap) {
      Store.get().players.forEach(x => { x.isCaptain = (x.id === p.id); });
    } else {
      p.isCaptain = false;
    }
    p.healthStatus = p.status;
    try {
      (Store.get().activeBoard.objects || []).forEach(o => {
        if (o.playerId === p.id) {
          o.status = p.status;
          o.isCaptain = !!p.isCaptain;
          o.position = p.position;
          o.readiness = p.readiness;
          o.load = p.load;
          o.label = p.lastName || o.label;
          o.number = p.number;
        }
        if (wantCap && o.playerId && o.playerId !== p.id) o.isCaptain = false;
      });
    } catch (_) {}

    const finish = () => {
      try { StorageManager.save(); } catch (_) {}
      Modal.close();
      Toast.show(wantCap ? 'Збережено · Капітан' : (p.status === 'injured' ? 'Збережено · Травма' : 'Збережено'), 'ok');
      App.renderCurrent();
      try { if (typeof BoardEngine !== 'undefined') BoardEngine.render(); } catch (_) {}
    };

    const fileInp = document.getElementById('pePhotoFile');
    const file = fileInp && fileInp.files && fileInp.files[0];
    if (file && file.type.startsWith('image/')) {
      Actions._compressImageFile(file, 512, 0.72).then(dataUrl => {
        if (dataUrl) {
          p.photoUrl = dataUrl;
          Toast.show('Фото збережено (' + Math.round(dataUrl.length / 1024) + ' КБ)', 'ok');
        } else {
          Toast.show('Не вдалося обробити фото', 'warn');
        }
        finish();
      }).catch(() => finish());
      return;
    }
    // якщо в полі URL вже data: — теж зберігаємо
    if (pePhotoVal && pePhotoVal.indexOf('data:image') === 0) p.photoUrl = pePhotoVal;
    finish();
  },

  /** Стиснення фото до JPEG dataURL (макс. side px, quality 0..1) */
  _compressImageFile(file, maxSide, quality) {
    maxSide = maxSide || 512;
    quality = quality == null ? 0.72 : quality;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve('');
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            if (!w || !h) return resolve(String(reader.result || ''));
            const scale = Math.min(1, maxSide / Math.max(w, h));
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            let out = canvas.toDataURL('image/jpeg', quality);
            // якщо все ще велике — сильніше стискаємо
            if (out.length > 280000) out = canvas.toDataURL('image/jpeg', 0.55);
            if (out.length > 280000) out = canvas.toDataURL('image/jpeg', 0.4);
            resolve(out);
          } catch (e) {
            resolve(String(reader.result || ''));
          }
        };
        img.onerror = () => resolve(String(reader.result || ''));
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  },

  openAttendance(trainingId) {
    const t = Store.get().trainings.find(x => x.id === trainingId);
    if (!t) { Toast.show('Тренування не знайдено', 'warn'); return; }
    if (!t.attendance) t.attendance = {};
    const players = (Store.get().players || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
    const rows = players.map(p => {
      const a = t.attendance[p.id] || {};
      const present = a.present !== false; // default present
      const hasRecord = t.attendance[p.id] != null;
      const checked = hasRecord ? !!a.present : true;
      const intv = a.intensity != null ? a.intensity : (t.intensity || 6);
      return `<div class="att-row" data-pid="${p.id}">
        <label class="att-check"><input type="checkbox" class="att-present" ${checked ? 'checked' : ''}> <span>${p.number}. ${sanitize(p.lastName || p.firstName || '')}</span></label>
        <span class="att-pos">${sanitize(p.position || '')}</span>
        <input type="number" class="att-rpe" min="1" max="10" value="${intv}" title="Індивідуальний RPE" ${checked ? '' : 'disabled'}>
      </div>`;
    }).join('');
    Modal.open('Відвідування · ' + sanitize(t.name), `
      <p class="note-sm">Позначте присутніх і RPE (1–10). Можна заповнити і для <strong>минулих</strong> тренувань — нові гравці в списку теж зʼявляться тут.</p>
      <div class="att-toolbar">
        <button type="button" class="btn btn-s btn-sm" id="attAllOn">Усі ✓</button>
        <button type="button" class="btn btn-s btn-sm" id="attAllOff">Нікого</button>
        <button type="button" class="btn btn-s btn-sm" id="attRpeAll">RPE = сесія (${t.intensity || 6})</button>
      </div>
      <div class="att-list">${rows || '<div class="es">Немає гравців у складі</div>'}</div>
    `, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Зберегти відвідування', cls: 'btn-p', action: 'save-attendance' }
    ]);
    const btn = document.querySelector('[data-modal-action="save-attendance"]');
    if (btn) btn.dataset.tid = trainingId;
    const list = document.querySelector('.att-list');
    list?.addEventListener('change', e => {
      if (e.target.classList.contains('att-present')) {
        const row = e.target.closest('.att-row');
        const rpe = row?.querySelector('.att-rpe');
        if (rpe) rpe.disabled = !e.target.checked;
      }
    });
    document.getElementById('attAllOn')?.addEventListener('click', () => {
      list?.querySelectorAll('.att-row').forEach(row => {
        const c = row.querySelector('.att-present');
        const r = row.querySelector('.att-rpe');
        if (c) c.checked = true;
        if (r) r.disabled = false;
      });
    });
    document.getElementById('attAllOff')?.addEventListener('click', () => {
      list?.querySelectorAll('.att-row').forEach(row => {
        const c = row.querySelector('.att-present');
        const r = row.querySelector('.att-rpe');
        if (c) c.checked = false;
        if (r) r.disabled = true;
      });
    });
    document.getElementById('attRpeAll')?.addEventListener('click', () => {
      const v = t.intensity || 6;
      list?.querySelectorAll('.att-rpe').forEach(r => { r.value = v; });
    });
  },

  saveAttendance(trainingId) {
    const t = Store.get().trainings.find(x => x.id === trainingId);
    if (!t) return;
    if (!t.attendance) t.attendance = {};
    document.querySelectorAll('.att-row').forEach(row => {
      const pid = row.dataset.pid;
      if (!pid) return;
      const present = !!row.querySelector('.att-present')?.checked;
      const intensity = Math.max(1, Math.min(10, +row.querySelector('.att-rpe')?.value || t.intensity || 6));
      t.attendance[pid] = { present, intensity, updatedAt: new Date().toISOString() };
    });
    // позначення сесії як проведеної, якщо була planned
    if (t.status === 'planned') t.status = 'done';
    try { LoadModel.recomputePlayerLoads(Store.get().players, Store.get().trainings); } catch (_) {}
    StorageManager.save();
    Modal.close();
    const n = Object.values(t.attendance).filter(a => a.present).length;
    Toast.show('Відвідування: ' + n + ' присутніх', 'ok');
    App.renderCurrent();
  },

  newExercise() {
    Modal.open('Нова вправа', `
      <div class="fg">
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_name','Назва'):'Назва')}</label><input id="exN"></div>
        <div class="fgr full"><label>Опис</label><textarea id="exD"></textarea></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_category','Категорія'):'Категорія')}</label><select id="exC">
          <option value="warmup">Warm-up</option><option value="passing">Passing</option>
          <option value="possession">Possession</option><option value="finishing">Finishing</option>
          <option value="defending">Defending</option><option value="pressing">Pressing</option>
          <option value="transition">Transition</option><option value="buildup">Build-up</option>
          <option value="goalkeeping">Goalkeeping</option><option value="conditioning">Conditioning</option>
        </select></div>
        <div class="fgr"><label>${(typeof I18n!=='undefined'?I18n.t('label_goal','Мета'):'Мета')}</label><input id="exO"></div>
        <div class="fgr"><label>Гравців</label><input type="number" id="exP" value="10"></div>
        <div class="fgr"><label>Зона</label><input id="exA" value="Половина"></div>
        <div class="fgr"><label>Тривалість</label><input type="number" id="exDu" value="15"></div>
        <div class="fgr"><label>RPE</label><input type="number" id="exI" value="6" min="1" max="10"></div>
        <div class="fgr full"><label>Інвентар</label><input id="exE" value="м\'ячі, фішки"></div>
        <div class="fgr full"><label>Інструкції</label><textarea id="exIn"></textarea></div>
        <div class="fgr full"><label>Coaching Points</label><textarea id="exCp"></textarea></div>
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Створити', cls: 'btn-p', action: 'create-exercise' }
    ]);
  },

  createExercise() {
    const name = document.getElementById('exN')?.value?.trim();
    if (!name) { Toast.show((typeof I18n!=='undefined'?I18n.t('toast_need_name','Вкажіть назву'):'Вкажіть назву'), 'warn'); return; }
    Store.get().exercises.push({
      id: uid(), name, description: document.getElementById('exD')?.value,
      category: document.getElementById('exC')?.value, objective: document.getElementById('exO')?.value,
      players: +document.getElementById('exP')?.value || 10, area: document.getElementById('exA')?.value,
      duration: +document.getElementById('exDu')?.value || 15, intensity: +document.getElementById('exI')?.value || 6,
      equipment: (document.getElementById('exE')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      instructions: document.getElementById('exIn')?.value, coachingPoints: document.getElementById('exCp')?.value,
      progression: '', regression: '', boardSetup: null
    });
    StorageManager.save();
    Modal.close();
    Toast.show('Вправу створено', 'ok');
    App.renderCurrent();
  },

  viewExercise(id) {
    const e = Store.get().exercises.find(x => x.id === id);
    if (!e) return;
    Modal.open(e.name, `
      <p style="font-size:13px;line-height:1.7;color:var(--muted)">
        <strong>Категорія:</strong> ${e.category}<br>
        <strong>Мета:</strong> ${sanitize(e.objective || '—')}<br>
        <strong>Опис:</strong> ${sanitize(e.description || '—')}<br>
        <strong>Гравців:</strong> ${e.players} · <strong>Зона:</strong> ${sanitize(e.area || '')}<br>
        <strong>Час:</strong> ${e.duration}хв · <strong>RPE:</strong> ${e.intensity}<br>
        <strong>Інвентар:</strong> ${(e.equipment || []).join(', ')}<br>
        <strong>Інструкції:</strong> ${sanitize(e.instructions || '—')}<br>
        <strong>Coaching Points:</strong> ${sanitize(e.coachingPoints || '—')}
      </p>
      <div class="fa">
        <button class="btn btn-p btn-sm" data-action="close-modal" onclick="BoardEngine.applyScheme('4-3-3');Modal.close();Toast.show('Схему застосовано. Відкрийте дошку через логотип.','ok')">OPEN ON BOARD</button>
        <button class="btn btn-d btn-sm" data-del-ex="${e.id}">Видалити</button>
      </div>`, [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
    document.getElementById('modalBody').querySelector('[data-del-ex]')?.addEventListener('click', () => {
      Modal.confirm((typeof t==='function'?t('confirm_del_exercise'):'Видалити вправу?'), () => {
        Store.get().exercises = Store.get().exercises.filter(x => x.id !== e.id);
        StorageManager.save(); Modal.close(); App.renderCurrent();
      });
    });
  },

  newMatch() {
    Modal.open('Новий матч', `
      <div class="fg">
        <div class="fgr full"><label>Суперник</label><input id="mOpp"></div>
        <div class="fgr"><label>Дата</label><input type="date" id="mDate" value="${today()}"></div>
        <div class="fgr"><label>Час</label><input type="time" id="mTime" value="15:00"></div>
        <div class="fgr"><label>Домашній?</label><select id="mHome"><option value="true">Домашній</option><option value="false">Виїзний</option></select></div>
        <div class="fgr"><label>Стадіон</label><input id="mStad" value="Стадіон Металіст"></div>
        <div class="fgr"><label>Схема</label><select id="mSch">${Object.keys(SCHEMES).map(k=>`<option>${k}</option>`).join('')}</select></div>
        <div class="fgr full"><label>План матчу</label><textarea id="mPlan"></textarea></div>
        <div class="fgr"><label>1-й тайм</label><textarea id="mP1"></textarea></div>
        <div class="fgr"><label>2-й тайм</label><textarea id="mP2"></textarea></div>
        <div class="fgr full"><label>Стандарти / Пресинг / Переходи</label><textarea id="mTac"></textarea></div>
        <div class="fgr full"><label>Передматчеві нотатки</label><textarea id="mPre"></textarea></div>
        <div class="fgr full"><label>Післяматчевий аналіз</label><textarea id="mPost"></textarea></div>
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Створити', cls: 'btn-p', action: 'create-match' }
    ]);
  },

  createMatch() {
    const opponent = document.getElementById('mOpp')?.value?.trim();
    if (!opponent) { Toast.show('Вкажіть суперника', 'warn'); return; }
    const m = {
      id: uid(), opponent, date: document.getElementById('mDate')?.value || today(),
      time: document.getElementById('mTime')?.value, home: document.getElementById('mHome')?.value === 'true',
      stadium: document.getElementById('mStad')?.value, scheme: document.getElementById('mSch')?.value,
      plan: document.getElementById('mPlan')?.value, plan1: document.getElementById('mP1')?.value,
      plan2: document.getElementById('mP2')?.value, tactics: document.getElementById('mTac')?.value,
      preNotes: document.getElementById('mPre')?.value, postNotes: document.getElementById('mPost')?.value
    };
    Store.get().matches.push(m);
    Store.get().calendar.push({ id: uid(), type: 'MATCH', title: 'vs ' + opponent, date: m.date, time: m.time, matchId: m.id });
    StorageManager.save();
    Modal.close();
    Toast.show('Матч створено', 'ok');
    App.renderCurrent();
  },

  viewMatch(id) {
    const m = Store.get().matches.find(x => x.id === id);
    if (!m) return;
    Modal.open('vs ' + m.opponent, `
      <p style="font-size:13px;line-height:1.8;color:var(--muted)">
        <strong>Дата:</strong> ${m.date} ${m.time || ''}<br>
        <strong>Стадіон:</strong> ${sanitize(m.stadium || '')}<br>
        <strong>Схема:</strong> ${m.scheme || '—'}<br>
        <strong>План:</strong> ${sanitize(m.plan || '—')}<br>
        <strong>1-й тайм:</strong> ${sanitize(m.plan1 || '—')}<br>
        <strong>2-й тайм:</strong> ${sanitize(m.plan2 || '—')}<br>
        <strong>Тактика:</strong> ${sanitize(m.tactics || '—')}<br>
        <strong>Перед:</strong> ${sanitize(m.preNotes || '—')}<br>
        <strong>Після:</strong> ${sanitize(m.postNotes || '—')}
      </p>`, [
      { label: 'Закрити', cls: 'btn-s', action: 'cancel' },
      { label: 'На дошку', cls: 'btn-p', action: 'cancel' }
    ]);
    const btn = document.querySelector('#modalFooter .btn-p');
    if (btn) btn.onclick = () => { if (m.scheme) BoardEngine.applyScheme(m.scheme); Modal.close(); Toast.show('Схему застосовано. Відкрийте дошку через логотип.','ok'); };
  },

  newEvent() {
    Modal.open('Нова подія', `
      <div class="fg">
        <div class="fgr full"><label>${(typeof I18n!=='undefined'?I18n.t('label_name','Назва'):'Назва')}</label><input id="evN"></div>
        <div class="fgr"><label>Дата</label><input type="date" id="evD" value="${Store.get().ui.selectedDay || today()}"></div>
        <div class="fgr"><label>Час</label><input type="time" id="evT" value="10:00"></div>
        <div class="fgr"><label>Тип</label><select id="evTy">
          <option value="TRAINING">Тренування</option><option value="MATCH">Матч</option>
          <option value="RECOVERY">Відновлення</option><option value="DAY_OFF">Вихідний</option>
          <option value="INDIVIDUAL">Індивідуальна</option>
        </select></div>
        <div class="fgr full"><label>Нотатки</label><textarea id="evNo"></textarea></div>
      </div>`, [
      { label: (typeof t==='function'?t('cancel'):'Скасувати'), cls: 'btn-s', action: 'cancel' },
      { label: 'Створити', cls: 'btn-p', action: 'create-event' }
    ]);
  },

  createEvent() {
    const title = document.getElementById('evN')?.value?.trim();
    if (!title) { Toast.show((typeof I18n!=='undefined'?I18n.t('toast_need_name','Вкажіть назву'):'Вкажіть назву'), 'warn'); return; }
    Store.get().calendar.push({
      id: uid(), title, date: document.getElementById('evD')?.value || today(),
      time: document.getElementById('evT')?.value, type: document.getElementById('evTy')?.value,
      notes: document.getElementById('evNo')?.value
    });
    StorageManager.save();
    Modal.close();
    Toast.show('Подію створено', 'ok');
    App.renderCurrent();
  },

  applyMicrocycle() {
    const start = Store.get().ui.selectedDay || today();
    const names = ['MD+1 Відновлення', 'MD+2 Техніка', 'MD-3 Тактика+Фізика', 'MD-2 Висока інтенсивність', 'MD-1 Активація', 'Match Day', 'MD+1 Відновлення'];
    const types = ['RECOVERY', 'TRAINING', 'TRAINING', 'TRAINING', 'TRAINING', 'MATCH', 'RECOVERY'];
    const base = new Date(start + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      if (!Store.get().calendar.some(e => e.date === ds && e.title === names[i])) {
        Store.get().calendar.push({ id: uid(), title: names[i], date: ds, time: '10:00', type: types[i], notes: 'Авто-мікроцикл' });
      }
    }
    StorageManager.save();
    Toast.show('Мікроцикл створено', 'ok');
    App.renderCurrent();
  },

  applyTemplate(t) {
    const ds = Store.get().ui.selectedDay || today();
    const map = { 'md-1': 'MD-1 Активація', 'md': 'Match Day', 'md+1': 'MD+1 Відновлення' };
    Store.get().calendar.push({ id: uid(), title: map[t] || t, date: ds, time: '10:00', type: t === 'md' ? 'MATCH' : 'TRAINING' });
    StorageManager.save();
    Toast.show('Шаблон застосовано', 'ok');
    App.renderCurrent();
  },

  saveSettings() {
    const s = Store.get().settings;
    // IDs must match settings form in views.js
    const clubEl = document.getElementById('setClubName') || document.getElementById('setName');
    const shortEl = document.getElementById('setClubShort') || document.getElementById('setShort');
    const priEl = document.getElementById('setPrimary') || document.getElementById('setPri');
    const accEl = document.getElementById('setAccent') || document.getElementById('setAcc');
    if (clubEl && clubEl.value.trim()) s.clubName = clubEl.value.trim();
    if (shortEl && shortEl.value.trim()) s.clubShort = shortEl.value.trim();
    if (priEl && priEl.value) s.primary = priEl.value;
    if (accEl && accEl.value) s.accent = accEl.value;
    const durEl = document.getElementById('setDur') || document.getElementById('setDefaultDuration');
    const intEl = document.getElementById('setInt') || document.getElementById('setDefaultIntensity');
    if (durEl) s.defaultDuration = +durEl.value || 90;
    if (intEl) s.defaultIntensity = +intEl.value || 6;
    const autoEl = document.getElementById('setAuto') || document.getElementById('setAutosave');
    if (autoEl) s.autosave = autoEl.checked !== false;
    // Social for guests
    if (!s.social) s.social = {};
    const tgCh = document.getElementById('setTgChannel')?.value?.trim();
    const ig = document.getElementById('setIg')?.value?.trim();
    const yt = document.getElementById('setYt')?.value?.trim();
    if (tgCh != null) { s.social.telegram = tgCh; s.telegramChannel = tgCh; }
    if (ig != null) { s.social.instagram = ig; s.instagram = ig; }
    if (yt != null) { s.social.youtube = yt; s.youtube = yt; }
    const gm = document.getElementById('setGuestMedia')?.value;
    if (gm != null) {
      s.guestMedia = gm.split(/\n/).map(x => x.trim()).filter(Boolean);
      s.social.media = s.guestMedia;
    }

    s.sound = document.getElementById('setSound')?.checked !== false;
    const coachNameEl = document.getElementById('setCoachName');
    if (coachNameEl && coachNameEl.value.trim()) s.coachName = coachNameEl.value.trim();
    const coachPhotoUrl = document.getElementById('setCoachPhoto')?.value?.trim();
    if (coachPhotoUrl) s.coachPhoto = coachPhotoUrl;

    const logoFile = document.getElementById('setLogo')?.files?.[0];
    const coachFile = document.getElementById('setCoachPhotoFile')?.files?.[0];

    const finishSave = () => {
      StorageManager.save();
      App.applyBranding();
      Toast.show('Налаштування збережено', 'ok');
      try { App.renderCurrent(); } catch (_) {}
    };

    const tasks = [];
    if (logoFile) {
      tasks.push(new Promise(res => {
        const reader = new FileReader();
        reader.onload = ev => { s.logoData = ev.target.result; res(); };
        reader.onerror = () => res();
        reader.readAsDataURL(logoFile);
      }));
    }
    if (coachFile && coachFile.type.startsWith('image/')) {
      tasks.push(Actions._compressImageFile(coachFile, 512, 0.72).then(data => {
        if (data) s.coachPhoto = data;
      }).catch(() => {}));
    }
    if (tasks.length) Promise.all(tasks).then(finishSave);
    else finishSave();
  }
};

/* ─── BOOT ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  try { App.init(); }
  catch (e) { ErrorManager.log('init', e); console.error(e);
    document.body.innerHTML = '<div style="padding:40px;max-width:480px;margin:40px auto;font-family:system-ui,sans-serif">' +
      '<h2 style="color:#e74c3c">Помилка запуску</h2>' +
      '<p style="color:#e6edf3">Не вдалося ініціалізувати застосунок.</p>' +
      '<pre style="background:#161b22;padding:12px;border-radius:8px;color:#f85149;overflow:auto;font-size:12px">' +
      (e && (e.message || String(e))) + '</pre>' +
      '<button onclick="localStorage.clear();location.reload()" style="margin-top:16px;padding:10px 16px;background:#c8a84b;border:0;border-radius:8px;font-weight:700;cursor:pointer">' +
      'Очистити дані і перезавантажити</button></div>'; }
});

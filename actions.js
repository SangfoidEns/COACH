/** Extracted module: src/ui/actions.js lines 2395-3022 — DO NOT rewrite business logic */
const Actions = {

  newMyEx() {
    Modal.open('Нова вправа', `
      <div class="fg">
        <div class="fgr full"><label>Назва</label><input id="mxN" placeholder="3v2 Build-up"></div>
        <div class="fgr"><label>Категорія</label>
          <select id="mxCat"><option>build-up</option><option>pressing</option><option>transition</option>
          <option>finishing</option><option>possession</option><option>defending</option><option>set-piece</option>
          <option>back-three</option><option>wing-back</option></select>
        </div>
        <div class="fgr"><label>Хв</label><input type="number" id="mxD" value="15"></div>
        <div class="fgr"><label>RPE</label><input type="number" id="mxI" value="6" min="1" max="10"></div>
        <div class="fgr full"><label>Мета</label><input id="mxO" placeholder="Progress through first line"></div>
        <div class="fgr full"><label>Coaching points</label><textarea id="mxCP"></textarea></div>
        <div class="fgr full"><label>Tags (кома)</label><input id="mxT" placeholder="3defenders, build-up"></div>
        <div class="fgr full"><label><input type="checkbox" id="mxBoard" checked> Зберегти поточну дошку</label></div>
      </div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'Створити', cls: 'btn-p', action: 'create-myex' }
    ]);
  },
  createMyEx() {
    const name = document.getElementById('mxN')?.value?.trim();
    if (!name) { Toast.show('Вкажіть назву', 'warn'); return; }
    const useBoard = document.getElementById('mxBoard')?.checked;
    const board = useBoard ? { objects: JSON.parse(JSON.stringify(Store.get().activeBoard.objects)) } : null;
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
    Toast.show('Вправу збережено', 'ok');
    App.navigate('myex');
  },
  myExFromBoard() {
    this.newMyEx();
  },
  newDiary() {
    const players = Store.get().players.map(p => `<option value="${p.id}">${p.number}. ${p.firstName} ${p.lastName}</option>`).join('');
    Modal.open('Запис у щоденник', `
      <div class="fg">
        <div class="fgr full"><label>Заголовок</label><input id="dyT" placeholder="Проблема проти high press"></div>
        <div class="fgr"><label>Категорія</label>
          <select id="dyC"><option>Tactical Idea</option><option>Training Reflection</option>
          <option>Match Reflection</option><option>Player Observation</option><option>Team Observation</option>
          <option>Problem</option><option>Solution</option><option>Goal</option><option>Meeting</option><option>Personal Note</option></select>
        </div>
        <div class="fgr"><label>Настрій</label><select id="dyM"><option></option><option>😊</option><option>😐</option><option>😤</option><option>💡</option></select></div>
        <div class="fgr full"><label>Текст</label><textarea id="dyX" rows="5"></textarea></div>
        <div class="fgr"><label>Гравець</label><select id="dyP"><option value="">—</option>${players}</select></div>
        <div class="fgr full"><label>Tags</label><input id="dyTags" placeholder="3defenders, pressing"></div>
        <div class="fgr full"><label><input type="checkbox" id="dyBoard"> Прикріпити поточну дошку</label></div>
      </div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'Зберегти', cls: 'btn-p', action: 'create-diary' }
    ]);
  },
  createDiary() {
    const title = document.getElementById('dyT')?.value?.trim() || 'Запис';
    const board = document.getElementById('dyBoard')?.checked
      ? { objects: JSON.parse(JSON.stringify(Store.get().activeBoard.objects)) } : null;
    Store.get().diary = Store.get().diary || [];
    Store.get().diary.push({
      id: uid(), title,
      category: document.getElementById('dyC')?.value,
      mood: document.getElementById('dyM')?.value,
      text: document.getElementById('dyX')?.value || '',
      playerId: document.getElementById('dyP')?.value || '',
      tags: (document.getElementById('dyTags')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      board, date: today(),
      createdAt: new Date().toISOString()
    });
    StorageManager.save(); Modal.close();
    Toast.show('Запис додано', 'ok');
    App.navigate('diary');
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
        <div class="fgr full"><label>Назва</label><input id="tName" value="Тренування ${fmtDate(new Date())}"></div>
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
        <div class="fgr"><label>Статус</label><select id="tSt"><option value="draft">Чернетка</option><option value="planned">Заплановане</option><option value="pinned">Закріплене</option></select></div>
      </div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'Зберегти', cls: 'btn-p', action: 'create-training' }
    ]);
  },

  createTraining() {
    const name = document.getElementById('tName')?.value?.trim();
    if (!name) { Toast.show('Вкажіть назву', 'warn'); return; }
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
        <div class="fgr full"><label>Назва</label><input id="teName" value="${sanitize(t.name)}"></div>
        <div class="fgr"><label>Дата</label><input type="date" id="teDate" value="${t.date}"></div>
        <div class="fgr"><label>Час</label><input type="time" id="teTime" value="${t.time || ''}"></div>
        <div class="fgr"><label>Статус</label><select id="teSt">
          ${['draft','planned','done','pinned'].map(s => `<option value="${s}" ${t.status===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="fgr"><label>RPE</label><input type="number" id="teInt" value="${t.intensity || 6}" min="1" max="10"></div>
        <div class="fgr full"><label>Мета</label><input id="teGoal" value="${sanitize(t.mainGoal || '')}"></div>
        <div class="fgr full"><label>Коментар</label><textarea id="teCom">${sanitize(t.comment || '')}</textarea></div>
      </div>
      <div class="ct" style="margin-top:12px">Структура (разом: <strong id="totalDur">${total}</strong> хв)</div>
      <div id="structList">${structHtml}</div>
      <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
        ${['Розминка:10','Активація:8','Техніка:15','Тактика:15','Фізика:10','Гра:15','Пауза:5','Вода:3','Пояснення:5','Заминка:10'].map(x => {
          const [n, d] = x.split(':');
          return `<button class="btn btn-s btn-sm" data-add-block="${id}:${n}:${d}">+ ${n}</button>`;
        }).join('')}
      </div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'На дошку', cls: 'btn-s', action: 'cancel' },
      { label: 'Зберегти', cls: 'btn-p', action: 'save-training', /* tid via dataset */ }
    ]);
    // attach tid
    const saveBtn = document.querySelector('[data-modal-action="save-training"]');
    if (saveBtn) saveBtn.dataset.tid = id;

    // block actions via delegation on modal
    document.getElementById('modalBody').onclick = e => {
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
    StorageManager.save();
    Modal.close();
    Toast.show('Збережено', 'ok');
    App.renderCurrent();
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
        <div class="fgr"><label>Ім\'я</label><input id="plF"></div>
        <div class="fgr"><label>Прізвище</label><input id="plL"></div>
        <div class="fgr"><label>Номер</label><input type="number" id="plN" min="1" max="99"></div>
        <div class="fgr"><label>Позиція</label><select id="plP">${['GK','CB','LB','RB','DM','CM','AM','LW','RW','ST'].map(p=>`<option>${p}</option>`).join('')}</select></div>
        <div class="fgr"><label>Вік</label><input type="number" id="plA" value="24"></div>
        <div class="fgr"><label>Статус</label><select id="plS">
          <option value="available">Available</option><option value="injured">Injured</option>
          <option value="recovery">Recovery</option><option value="suspended">Suspended</option>
          <option value="individual">Individual</option><option value="unavailable">Unavailable</option>
        </select></div>
        <div class="fgr"><label>Стан %</label><input type="number" id="plC" value="90" min="0" max="100"></div>
        <div class="fgr"><label>Готовність %</label><input type="number" id="plR" value="95" min="0" max="100"></div>
        <div class="fgr"><label>Група</label><select id="plG"><option value="main">Основний</option><option value="reserve">Резерв</option><option value="gk">Воротарі</option></select></div>
        <div class="fgr full"><label>Примітки</label><textarea id="plNo"></textarea></div>
      </div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'Додати', cls: 'btn-p', action: 'create-player' }
    ]);
  },

  createPlayer() {
    const firstName = document.getElementById('plF')?.value?.trim();
    const lastName = document.getElementById('plL')?.value?.trim();
    if (!firstName && !lastName) { Toast.show('Вкажіть ім\'я', 'warn'); return; }
    Store.get().players.push({
      id: uid(), firstName, lastName,
      number: +document.getElementById('plN')?.value || 99,
      position: document.getElementById('plP')?.value || 'CM',
      secondaryPositions: [], age: +document.getElementById('plA')?.value || 20,
      status: document.getElementById('plS')?.value || 'available',
      condition: +document.getElementById('plC')?.value || 90,
      readiness: +document.getElementById('plR')?.value || 90,
      load: 0, notes: document.getElementById('plNo')?.value || '',
      group: document.getElementById('plG')?.value || 'main', tags: []
    });
    StorageManager.save();
    Modal.close();
    Toast.show('Гравця додано', 'ok');
    App.renderCurrent();
  },

  editPlayer(id) {
    const p = Store.get().players.find(x => x.id === id);
    if (!p) return;
    Modal.open('Редагування гравця', `
      <div class="fg">
        <div class="fgr"><label>Ім\'я</label><input id="peF" value="${sanitize(p.firstName)}"></div>
        <div class="fgr"><label>Прізвище</label><input id="peL" value="${sanitize(p.lastName)}"></div>
        <div class="fgr"><label>Номер</label><input type="number" id="peN" value="${p.number}"></div>
        <div class="fgr"><label>Позиція</label><select id="peP">${['GK','CB','LB','RB','DM','CM','AM','LW','RW','ST'].map(pos=>`<option ${p.position===pos?'selected':''}>${pos}</option>`).join('')}</select></div>
        <div class="fgr"><label>Вік</label><input type="number" id="peA" value="${p.age}"></div>
        <div class="fgr"><label>Статус</label><select id="peS">
          ${['available','injured','recovery','suspended','individual','unavailable'].map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="fgr"><label>Стан %</label><input type="number" id="peC" value="${p.condition}"></div>
        <div class="fgr"><label>Готовність %</label><input type="number" id="peR" value="${p.readiness}"></div>
        <div class="fgr"><label>Load (0-10)</label><input type="number" id="peLoad" value="${p.load||0}" min="0" max="10"></div>
        <div class="fgr"><label>Група</label><select id="peG">
          <option value="main" ${p.group==='main'?'selected':''}>Основний</option>
          <option value="reserve" ${p.group==='reserve'?'selected':''}>Резерв</option>
          <option value="gk" ${p.group==='gk'?'selected':''}>Воротарі</option>
        </select></div>
        <div class="fgr full"><label>Примітки / Індивідуальна програма</label><textarea id="peNo">${sanitize(p.notes||'')}</textarea></div>
      </div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
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
    p.condition = +document.getElementById('peC')?.value ?? p.condition;
    p.readiness = +document.getElementById('peR')?.value ?? p.readiness;
    p.load = +document.getElementById('peLoad')?.value ?? p.load;
    p.group = document.getElementById('peG')?.value || p.group;
    p.notes = document.getElementById('peNo')?.value || '';
    StorageManager.save();
    Modal.close();
    Toast.show('Збережено', 'ok');
    App.renderCurrent();
  },

  newExercise() {
    Modal.open('Нова вправа', `
      <div class="fg">
        <div class="fgr full"><label>Назва</label><input id="exN"></div>
        <div class="fgr full"><label>Опис</label><textarea id="exD"></textarea></div>
        <div class="fgr"><label>Категорія</label><select id="exC">
          <option value="warmup">Warm-up</option><option value="passing">Passing</option>
          <option value="possession">Possession</option><option value="finishing">Finishing</option>
          <option value="defending">Defending</option><option value="pressing">Pressing</option>
          <option value="transition">Transition</option><option value="buildup">Build-up</option>
          <option value="goalkeeping">Goalkeeping</option><option value="conditioning">Conditioning</option>
        </select></div>
        <div class="fgr"><label>Мета</label><input id="exO"></div>
        <div class="fgr"><label>Гравців</label><input type="number" id="exP" value="10"></div>
        <div class="fgr"><label>Зона</label><input id="exA" value="Половина"></div>
        <div class="fgr"><label>Тривалість</label><input type="number" id="exDu" value="15"></div>
        <div class="fgr"><label>RPE</label><input type="number" id="exI" value="6" min="1" max="10"></div>
        <div class="fgr full"><label>Інвентар</label><input id="exE" value="м\'ячі, фішки"></div>
        <div class="fgr full"><label>Інструкції</label><textarea id="exIn"></textarea></div>
        <div class="fgr full"><label>Coaching Points</label><textarea id="exCp"></textarea></div>
      </div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'Створити', cls: 'btn-p', action: 'create-exercise' }
    ]);
  },

  createExercise() {
    const name = document.getElementById('exN')?.value?.trim();
    if (!name) { Toast.show('Вкажіть назву', 'warn'); return; }
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
        <button class="btn btn-p btn-sm" data-action="close-modal" onclick="BoardEngine.applyScheme('4-3-3');Modal.close();App.navigate('board')">OPEN ON BOARD</button>
        <button class="btn btn-d btn-sm" data-del-ex="${e.id}">Видалити</button>
      </div>`, [{ label: 'Закрити', cls: 'btn-s', action: 'cancel' }]);
    document.getElementById('modalBody').querySelector('[data-del-ex]')?.addEventListener('click', () => {
      Modal.confirm('Видалити вправу?', () => {
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
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
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
    if (btn) btn.onclick = () => { if (m.scheme) BoardEngine.applyScheme(m.scheme); Modal.close(); App.navigate('board'); };
  },

  newEvent() {
    Modal.open('Нова подія', `
      <div class="fg">
        <div class="fgr full"><label>Назва</label><input id="evN"></div>
        <div class="fgr"><label>Дата</label><input type="date" id="evD" value="${Store.get().ui.selectedDay || today()}"></div>
        <div class="fgr"><label>Час</label><input type="time" id="evT" value="10:00"></div>
        <div class="fgr"><label>Тип</label><select id="evTy">
          <option value="TRAINING">Тренування</option><option value="MATCH">Матч</option>
          <option value="RECOVERY">Відновлення</option><option value="DAY_OFF">Вихідний</option>
          <option value="INDIVIDUAL">Індивідуальна</option>
        </select></div>
        <div class="fgr full"><label>Нотатки</label><textarea id="evNo"></textarea></div>
      </div>`, [
      { label: 'Скасувати', cls: 'btn-s', action: 'cancel' },
      { label: 'Створити', cls: 'btn-p', action: 'create-event' }
    ]);
  },

  createEvent() {
    const title = document.getElementById('evN')?.value?.trim();
    if (!title) { Toast.show('Вкажіть назву', 'warn'); return; }
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
    s.clubName = document.getElementById('setName')?.value || s.clubName;
    s.clubShort = document.getElementById('setShort')?.value || s.clubShort;
    s.primary = document.getElementById('setPri')?.value || s.primary;
    s.accent = document.getElementById('setAcc')?.value || s.accent;
    s.defaultDuration = +document.getElementById('setDur')?.value || 90;
    s.defaultIntensity = +document.getElementById('setInt')?.value || 6;
    s.autosave = document.getElementById('setAuto')?.checked !== false;
    s.sound = document.getElementById('setSound')?.checked !== false;
    const logoFile = document.getElementById('setLogo')?.files?.[0];
    if (logoFile) {
      const reader = new FileReader();
      reader.onload = ev => { s.logoData = ev.target.result; StorageManager.save(); App.applyBranding(); };
      reader.readAsDataURL(logoFile);
    }
    StorageManager.save();
    App.applyBranding();
    Toast.show('Налаштування збережено', 'ok');
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

/** Extracted module: src/ui/views.js lines 1491-1818 — DO NOT rewrite business logic */
const Views = {
  dashboard() {
    const s = Store.get();
    const avail = s.players.filter(p => p.status === 'available').length;
    const injured = s.players.filter(p => p.status === 'injured' || p.status === 'recovery').length;
    const next = s.trainings.filter(t => t.status === 'planned' && t.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const weekLoad = LoadModel.weeklyLoad(s.trainings);
    const totalHours = Math.round(s.trainings.reduce((a, t) => a + (t.duration || 0), 0) / 60 * 10) / 10;
    const nextMatch = s.matches.filter(m => m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const recent = s.trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    const drafts = s.trainings.filter(t => t.status === 'draft' || t.status === 'pinned');

    return `
      <div class="st">Головна панель тренера</div>
      <div class="dg">
        <div class="sc"><div class="lb">Доступні гравці</div><div class="vl">${avail}</div><div class="sb">з ${s.players.length}</div></div>
        <div class="sc"><div class="lb">Травмовані / відновлення</div><div class="vl" style="color:var(--danger)">${injured}</div></div>
        <div class="sc"><div class="lb">Наступне тренування</div><div class="vl" style="font-size:14px">${next ? sanitize(next.name) : '—'}</div><div class="sb">${next ? next.date + ' ' + (next.time || '') : ''}</div></div>
        <div class="sc"><div class="lb">Тривалість</div><div class="vl">${next ? next.duration : 0}<span style="font-size:13px"> хв</span></div></div>
        <div class="sc"><div class="lb">Тижневе навантаження</div><div class="vl">${weekLoad}</div><div class="sb">Duration × RPE (планувальний)</div></div>
        <div class="sc"><div class="lb">Години тренувань</div><div class="vl">${totalHours}</div></div>
        <div class="sc"><div class="lb">Наступний матч</div><div class="vl" style="font-size:14px">${nextMatch ? 'vs ' + sanitize(nextMatch.opponent) : '—'}</div><div class="sb">${nextMatch ? nextMatch.date : ''}</div></div>
        <div class="sc"><div class="lb">Тренувань</div><div class="vl">${s.trainings.length}</div></div>
      </div>
      <div class="qa">
        <button class="btn btn-p" data-action="new-training">+ Нове тренування</button>
        <button class="btn btn-s" data-view="board">⚽ Дошка</button>
        <button class="btn btn-s" data-view="players">👥 Склад</button>
        <button class="btn btn-s" data-view="calendar">📅 Календар</button>
        <button class="btn btn-s" data-view="tactics">📐 Тактика</button>
        <button class="btn btn-s" data-view="analytics">📈 Аналітика</button>
      </div>
      <div class="ai">
        <h3>🤖 AI ASSISTANT</h3>
        <div class="ai-b">
          <button class="btn btn-s" data-ai="training">Створити тренування</button>
          <button class="btn btn-s" data-ai="warmup">Створити розминку</button>
          <button class="btn btn-s" data-ai="tech">Технічна вправа</button>
          <button class="btn btn-s" data-ai="tactical">Тактична вправа</button>
          <button class="btn btn-s" data-ai="gk">Для воротарів</button>
          <button class="btn btn-s" data-ai="post">Після матчу</button>
          <button class="btn btn-s" data-ai="pre">Перед матчем</button>
          <button class="btn btn-s" data-ai="optimize">Оптимізувати навантаження</button>
          <button class="btn btn-s" data-ai="balance">Збалансувати</button>
          <button class="btn btn-s" data-ai="micro">Аналіз мікроциклу</button>
        </div>
        <p class="note-sm">Демо-логіка. Архітектура AIService готова для підключення Grok/OpenAI API.</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="card"><div class="ct">Останні тренування</div>
          ${recent.length ? recent.map(t => `<div class="li"><div class="inf"><div class="ti">${sanitize(t.name)}</div><div class="me">${t.date} · ${t.duration}хв · ${t.status}</div></div>
            <button class="btn btn-s btn-sm" data-edit-training="${t.id}">Відкрити</button></div>`).join('') : '<div class="es">Немає тренувань</div>'}
        </div>
        <div class="card"><div class="ct">Чернетки / Закріплені</div>
          ${drafts.length ? drafts.map(t => `<div class="li"><div class="inf"><div class="ti">${sanitize(t.name)}</div><div class="me"><span class="badge b-i">${t.status}</span></div></div>
            <button class="btn btn-s btn-sm" data-edit-training="${t.id}">Відкрити</button></div>`).join('') : '<div class="es">Немає чернеток</div>'}
        </div>
      </div>`;
  },

  trainings() {
    const s = Store.get();
    const list = s.trainings.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `
      <div class="st">Тренування <button class="btn btn-p btn-sm" data-action="new-training">+ Нове</button></div>
      <div class="fb">
        <input type="search" id="trSearch" placeholder="Пошук..." data-filter="trainings">
        <select id="trStatus" data-filter="trainings">
          <option value="">Всі статуси</option>
          <option value="draft">Чернетка</option><option value="planned">Заплановане</option>
          <option value="done">Проведено</option><option value="pinned">Закріплене</option>
        </select>
      </div>
      <div id="trList">${this._trList(list)}</div>`;
  },

  _trList(list) {
    if (!list.length) return '<div class="es"><div class="ic">📋</div>Немає тренувань</div>';
    return list.map(t => {
      const total = (t.structure || []).reduce((a, b) => a + (b.duration || 0), 0);
      return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div><strong>${sanitize(t.name)}</strong>
            <div class="me" style="font-size:11px;color:var(--muted);margin-top:3px">${t.date} ${t.time || ''} · ${t.duration}хв · <span class="badge b-i">${t.status}</span> · Load: ${LoadModel.sessionLoad(t.duration, t.intensity)}</div>
            ${t.structure ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${t.structure.map(b => sanitize(b.title || b.name) + '(' + b.duration + 'хв)').join(' → ')} = ${total}хв</div>` : ''}
          </div>
          <div style="display:flex;gap:3px">
            <button class="btn btn-s btn-sm" data-edit-training="${t.id}">Редагувати</button>
            <button class="btn btn-s btn-sm" data-dup-training="${t.id}">Дубль</button>
            <button class="btn btn-d btn-sm" data-del-training="${t.id}">✕</button>
          </div>
        </div>
      </div>`;
    }).join('');
  },

  players() {
    const s = Store.get();
    return `
      <div class="st">Склад команди <button class="btn btn-p btn-sm" data-action="new-player">+ Гравець</button></div>
      <div class="fb">
        <input type="search" id="plSearch" placeholder="Пошук..." data-filter="players">
        <select id="plPos" data-filter="players"><option value="">Всі позиції</option>${['GK','CB','LB','RB','DM','CM','AM','LW','RW','ST'].map(p=>`<option>${p}</option>`).join('')}</select>
        <select id="plSt" data-filter="players"><option value="">Всі статуси</option>
          <option value="available">Available</option><option value="injured">Injured</option>
          <option value="recovery">Recovery</option><option value="suspended">Suspended</option>
          <option value="individual">Individual</option><option value="unavailable">Unavailable</option>
        </select>
        <select id="plGr" data-filter="players"><option value="">Всі групи</option>
          <option value="main">Основний</option><option value="reserve">Резерв</option>
          <option value="gk">Воротарі</option><option value="def">Захист</option>
          <option value="mid">Півзахист</option><option value="att">Атака</option>
        </select>
      </div>
      <div class="tw"><table><thead><tr>
        <th>#</th><th>Гравець</th><th>Поз.</th><th>Вік</th><th>Статус</th><th>Стан</th><th>Готовність</th><th>Load</th><th></th>
      </tr></thead><tbody id="plTable">${this._plRows(s.players)}</tbody></table></div>
      <p class="note-sm">Load — планувальний показник (не медична оцінка).</p>`;
  },

  _plRows(list) {
    if (!list.length) return '<tr><td colspan="9" style="text-align:center;color:var(--muted)">Немає гравців</td></tr>';
    return list.map(p => {
      const bc = p.status === 'available' ? 'b-ok' : (p.status === 'injured' ? 'b-d' : 'b-w');
      const lc = (p.load || 0) < 4 ? 'll' : (p.load || 0) < 7 ? 'lm' : 'lh';
      return `<tr>
        <td><span class="pn ${p.position === 'GK' ? 'gk' : ''}">${p.number}</span></td>
        <td>${sanitize(p.firstName)} ${sanitize(p.lastName)}</td>
        <td>${p.position}</td><td>${p.age}</td>
        <td><span class="badge ${bc}">${p.status}</span></td>
        <td>${p.condition}%</td><td>${p.readiness}%</td>
        <td><div class="lb2"><div class="lbf ${lc}" style="width:${(p.load || 0) * 10}%"></div></div></td>
        <td>
          <button class="btn btn-s btn-sm" data-edit-player="${p.id}">✎</button>
          <button class="btn btn-d btn-sm" data-del-player="${p.id}">✕</button>
        </td>
      </tr>`;
    }).join('');
  },

  exercises() {
    const s = Store.get();
    return `
      <div class="st">Бібліотека вправ <button class="btn btn-p btn-sm" data-action="new-exercise">+ Вправа</button></div>
      <div class="fb">
        <input type="search" id="exSearch" placeholder="Пошук..." data-filter="exercises">
        <select id="exCat" data-filter="exercises">
          <option value="">Всі категорії</option>
          <option value="warmup">Warm-up</option><option value="passing">Passing</option>
          <option value="possession">Possession</option><option value="finishing">Finishing</option>
          <option value="defending">Defending</option><option value="pressing">Pressing</option>
          <option value="transition">Transition</option><option value="buildup">Build-up</option>
          <option value="goalkeeping">Goalkeeping</option><option value="conditioning">Conditioning</option>
          <option value="recovery">Recovery</option>
        </select>
      </div>
      <div id="exList">${s.exercises.map(e => `
        <div class="ec" data-view-exercise="${e.id}">
          <h4>${sanitize(e.name)}</h4>
          <div class="me">${e.category} · ${e.duration}хв · ${e.players} гр. · RPE ${e.intensity} · ${sanitize(e.objective || '')}</div>
        </div>`).join('') || '<div class="es">Немає вправ</div>'}`;
  },

  tactics() {
    const s = Store.get();
    return `
      <div class="st">Тактичні схеми</div>
      <div class="card"><div class="ct">Базові схеми</div>
        <div class="sg">${Object.keys(SCHEMES).map(k => `<button class="sb2" data-scheme="${k}">${k}</button>`).join('')}</div>
      </div>
      <div class="card"><div class="ct">Збережені схеми</div>
        ${s.boards.length ? s.boards.map(b => `
          <div class="li"><div class="inf"><div class="ti">${sanitize(b.name)}</div><div class="me">${fmtDate(b.createdAt)}</div></div>
            <div style="display:flex;gap:3px">
              <button class="btn btn-s btn-sm" data-load-board="${b.id}">Відкрити</button>
              <button class="btn btn-d btn-sm" data-del-board="${b.id}">✕</button>
            </div>
          </div>`).join('') : '<div class="es">Збережіть схему з дошки</div>'}
      </div>
      <div class="card"><div class="ct">Спеціальні</div>
        <div class="sg">
          ${['attack','defense','press','setpiece','transition','highpress'].map(t =>
            `<button class="sb2" data-special="${t}">${t}</button>`).join('')}
        </div>
      </div>`;
  },

  calendar() {
    const s = Store.get();
    const mode = s.ui.calView || 'month';
    const d = new Date(s.ui.calDate + 'T12:00:00');
    const year = d.getFullYear(), month = d.getMonth();
    const title = d.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = today();
    let grid = '<div class="cg">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].forEach(n => grid += `<div class="cdn">${n}</div>`);
    for (let i = 0; i < startDay; i++) grid += '<div class="cd om"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const has = s.calendar.some(e => e.date === ds) || s.trainings.some(t => t.date === ds) || s.matches.some(m => m.date === ds);
      grid += `<div class="cd ${ds === todayStr ? 'today' : ''} ${has ? 'has' : ''} ${s.ui.selectedDay === ds ? 'sel' : ''}" data-day="${ds}">${day}</div>`;
    }
    grid += '</div>';

    const ds = s.ui.selectedDay || todayStr;
    const events = [
      ...s.calendar.filter(e => e.date === ds),
      ...s.trainings.filter(t => t.date === ds).map(t => ({ type: 'TRAINING', title: t.name, time: t.time, id: t.id })),
      ...s.matches.filter(m => m.date === ds).map(m => ({ type: 'MATCH', title: 'vs ' + m.opponent, time: m.time, id: m.id }))
    ];

    return `
      <div class="st">Календар
        <div style="display:flex;gap:5px">
          <button class="btn btn-s btn-sm" data-action="cal-prev">←</button>
          <button class="btn btn-s btn-sm" data-action="cal-next">→</button>
          <button class="btn btn-p btn-sm" data-action="new-event">+ Подія</button>
        </div>
      </div>
      <div class="ch"><strong>${title}</strong></div>
      ${grid}
      <div class="card" style="margin-top:12px"><div class="ct">Події ${ds}</div>
        ${events.length ? events.map(e => `<div class="li"><div class="inf"><div class="ti">${sanitize(e.title || e.name)}</div><div class="me">${e.type || e.eventType} · ${e.time || ''}</div></div></div>`).join('') : '<div style="color:var(--muted);font-size:12px">Немає подій</div>'}
      </div>
      <div class="card"><div class="ct">Мікроцикл / Шаблони</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-s btn-sm" data-action="microcycle">Авто-мікроцикл</button>
          <button class="btn btn-s btn-sm" data-tpl="md-1">MD-1</button>
          <button class="btn btn-s btn-sm" data-tpl="md">Match Day</button>
          <button class="btn btn-s btn-sm" data-tpl="md+1">MD+1</button>
        </div>
        <p class="note-sm">MD+1 Recovery → MD+2 Tech → … → MD-1 Activation → MD Match</p>
      </div>`;
  },

  matches() {
    const s = Store.get();
    return `
      <div class="st">Матчі <button class="btn btn-p btn-sm" data-action="new-match">+ Матч</button></div>
      ${s.matches.length ? s.matches.map(m => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <div><strong>${m.home ? 'МЕТАЛІСТ ШТУТГАРТ' : sanitize(m.opponent)} vs ${m.home ? sanitize(m.opponent) : 'МЕТАЛІСТ ШТУТГАРТ'}</strong>
              <div class="me" style="font-size:11px;color:var(--muted);margin-top:3px">${m.date} ${m.time || ''} · ${sanitize(m.stadium || '')} · ${m.scheme || ''}</div>
            </div>
            <div style="display:flex;gap:3px">
              <button class="btn btn-s btn-sm" data-view-match="${m.id}">Деталі</button>
              <button class="btn btn-d btn-sm" data-del-match="${m.id}">✕</button>
            </div>
          </div>
        </div>`).join('') : '<div class="es"><div class="ic">🏆</div>Немає матчів</div>'}`;
  },

  analytics() {
    const s = Store.get();
    const totalTime = s.trainings.reduce((a, t) => a + (t.duration || 0), 0);
    const avgInt = s.trainings.length ? (s.trainings.reduce((a, t) => a + (t.intensity || 0), 0) / s.trainings.length).toFixed(1) : '—';
    const weekLoad = LoadModel.weeklyLoad(s.trainings);
    const recent = s.trainings.slice(-8);
    return `
      <div class="st">Аналітика <button class="btn btn-s btn-sm" data-action="export-stats">Export</button></div>
      <p class="note-sm" style="margin-bottom:12px">Load = Duration × RPE. Це планувальний показник, а не медична оцінка.</p>
      <div class="dg">
        <div class="sc"><div class="lb">Тренувань</div><div class="vl">${s.trainings.length}</div></div>
        <div class="sc"><div class="lb">Загальний час</div><div class="vl">${totalTime}<span style="font-size:13px"> хв</span></div></div>
        <div class="sc"><div class="lb">Сер. інтенсивність</div><div class="vl">${avgInt}</div></div>
        <div class="sc"><div class="lb">Тижневий Load</div><div class="vl">${weekLoad}</div></div>
      </div>
      <div class="card"><div class="ct">Навантаження (останні тренування)</div>
        <div class="cp"><div class="bc">${recent.length ? recent.map(t =>
          `<div class="bar" style="height:${Math.min(100, (LoadModel.sessionLoad(t.duration, t.intensity) / 10))}%" title="${sanitize(t.name)}: ${LoadModel.sessionLoad(t.duration, t.intensity)}"><span>${(t.date || '').slice(5)}</span></div>`
        ).join('') : '<div style="color:var(--muted)">Немає даних</div>'}</div></div>
      </div>
      <div class="card"><div class="ct">Індивідуальне навантаження</div>
        ${s.players.slice().sort((a, b) => (b.load || 0) - (a.load || 0)).map(p => {
          const lc = (p.load || 0) < 4 ? 'll' : (p.load || 0) < 7 ? 'lm' : 'lh';
          return `<div class="li"><div class="inf"><div class="ti">${p.number}. ${sanitize(p.firstName)} ${sanitize(p.lastName)}</div>
            <div class="me">${p.position} · ${p.condition}%</div></div>
            <div style="min-width:70px"><div class="lb2"><div class="lbf ${lc}" style="width:${(p.load || 0) * 10}%"></div></div></div>
          </div>`;
        }).join('')}
      </div>`;
  },

  settings() {
    const s = Store.get().settings;
    return `
      <div class="st">Налаштування</div>
      <div class="card"><div class="ct">Клуб</div>
        <div class="fg">
          <div class="fgr"><label>Назва</label><input id="setName" value="${sanitize(s.clubName)}"></div>
          <div class="fgr"><label>Скорочення</label><input id="setShort" value="${sanitize(s.clubShort)}" maxlength="4"></div>
          <div class="fgr"><label>Основний колір</label><input type="color" id="setPri" value="${s.primary}"></div>
          <div class="fgr"><label>Акцент</label><input type="color" id="setAcc" value="${s.accent}"></div>
          <div class="fgr"><label>Тривалість за замовч. (хв)</label><input type="number" id="setDur" value="${s.defaultDuration}"></div>
          <div class="fgr"><label>Інтенсивність за замовч.</label><input type="number" id="setInt" value="${s.defaultIntensity}" min="1" max="10"></div>
          <div class="fgr full"><label>Логотип (завантажити зображення)</label>
            <input type="file" id="setLogo" accept="image/*">
            ${s.logoData ? '<p class="note-sm">Логотип завантажено</p>' : '<p class="note-sm">Placeholder: CLUB LOGO</p>'}
          </div>
          <div class="fgr"><label><input type="checkbox" id="setAuto" ${s.autosave !== false ? 'checked' : ''}> Autosave</label></div>
          <div class="fgr"><label><input type="checkbox" id="setSound" ${s.sound !== false ? 'checked' : ''}> Звук таймера</label></div>
        </div>
        <div class="fa"><button class="btn btn-p" data-action="save-settings">Зберегти</button></div>
      </div>
      <div class="card"><div class="ct">Дані</div>
        <div class="fa">
          <button class="btn btn-s" data-action="export">Export JSON</button>
          <button class="btn btn-s" data-action="import-trigger">Import JSON</button>
          <input type="file" id="importFile" accept=".json" style="display:none">
          <button class="btn btn-s" data-action="print">Print</button>
          <button class="btn btn-d" data-action="reset-all">Скинути все</button>
        </div>
      </div>
      <div class="card"><div class="ct">Про застосунок</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.6">
          Football Coach Board v2 · МЕТАЛІСТ ШТУТГАРТ<br>
          Schema v${SCHEMA_VERSION} · localStorage · Vanilla JS<br>
          Production-quality prototype
        </p>
      </div>`;
  }
};

/* ─── AI SERVICE ────────────────────────────────────────── */

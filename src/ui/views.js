/** Extracted module: src/ui/views.js lines 1491-1818 — DO NOT rewrite business logic */
const Views = {
  dashboard() {
    const s = Store.get();
    const avail = s.players.filter(p => p.status === 'available').length;
    const injured = s.players.filter(p => p.status === 'injured' || p.status === 'recovery' || p.status === 'rehab').length;
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
      return `<div class="card card-training" data-edit-training="${t.id}" role="button" tabindex="0">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div><strong>${sanitize(t.name)}</strong>
            <div class="me" style="font-size:11px;color:var(--muted);margin-top:3px">${t.date} ${t.time || ''} · ${t.duration}хв · <span class="badge b-i">${t.status}</span> · Load: ${LoadModel.sessionLoad(t.duration, t.intensity)}</div>
            ${t.structure ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${t.structure.map(b => sanitize(b.title || b.name) + '(' + b.duration + 'хв)').join(' → ')} = ${total}хв</div>` : ''}
          </div>
          <div style="display:flex;gap:3px" onclick="event.stopPropagation()">
            <button type="button" class="btn btn-s btn-sm" data-attendance-training="${t.id}" title="Відвідування">✓ Відвід.</button>
            <button type="button" class="btn btn-s btn-sm" data-edit-training="${t.id}">Деталі</button>
            <button type="button" class="btn btn-s btn-sm" data-dup-training="${t.id}">Дубль</button>
            <button type="button" class="btn btn-d btn-sm" data-del-training="${t.id}">✕</button>
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
          <option value="available">Здоровий</option>
          <option value="injured">Травмований</option>
          <option value="rehab">Відновлення</option>
          <option value="suspended">Дискваліфікація</option>
          <option value="unavailable">Недоступний</option>
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
    const statusLabel = (st) => ({
      available: 'Здоровий', healthy: 'Здоровий', injured: 'Травмований',
      rehab: 'Відновлення', recovery: 'Відновлення', suspended: 'Дискваліфікація',
      unavailable: 'Недоступний', individual: 'Індивідуально'
    })[st] || st;
    return list.map(p => {
      const st = p.status || 'available';
      const bc = (st === 'available' || st === 'healthy') ? 'b-ok' : (st === 'injured' ? 'b-d' : 'b-w');
      const lc = (p.load || 0) < 4 ? 'll' : (p.load || 0) < 7 ? 'lm' : 'lh';
      const cap = p.isCaptain ? ' <span class="player-cap-tag">C</span>' : '';
      const tg = p.telegramUsername ? ' <span class="player-tg">@' + sanitize(p.telegramUsername) + '</span>' : '';
      const inj = (st === 'injured') ? ' <span class="player-inj-ico" title="Травма">✚</span>' : '';
      return `<tr>
        <td><span class="pn ${p.position === 'GK' ? 'gk' : ''}">${p.number}</span></td>
        <td>${sanitize(p.firstName)} ${sanitize(p.lastName)}${cap}${tg}${inj}</td>
        <td>${p.position}</td><td>${p.age}</td>
        <td><span class="badge ${bc}">${statusLabel(st)}</span></td>
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
      <div class="card"><div class="ct">Шаблони тренувальних розстановок</div>
        <p class="note-sm">Сучасні шаблони для дошки. Після відкриття можна вільно змінювати позиції, стрілки та зони.</p>
        <div class="sg">${(DEMO.boardTemplates||[]).map(t => `
          <button type="button" class="sb2" data-board-tpl="${t.scheme}" title="${sanitize(t.description)}"
            style="text-align:left;min-width:150px;padding:10px 12px">
            <strong>${sanitize(t.name)}</strong><br>
            <span style="font-size:10px;color:var(--muted)">${t.scheme}</span>
          </button>`).join('')}</div>
      </div>
      <div class="card"><div class="ct">Усі формації</div>
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
        ${events.length ? events.map(e => {
        const openAttr = e.type === 'TRAINING' && e.id ? ` data-edit-training="${e.id}"` : (e.type === 'MATCH' && e.id ? ` data-view-match="${e.id}"` : '');
        return `<div class="li"${openAttr} style="cursor:pointer"><div class="inf"><div class="ti">${sanitize(e.title || e.name)}</div><div class="me">${e.type || e.eventType} · ${e.time || ''}</div></div></div>`;
      }).join('') : '<div style="color:var(--muted);font-size:12px">Немає подій</div>'}
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
    const recent = s.trainings.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(-8);
    const withAtt = s.trainings.filter(t => t.attendance && Object.keys(t.attendance).length);
    let attPresent = 0, attTotal = 0;
    withAtt.forEach(t => {
      Object.values(t.attendance).forEach(a => { attTotal++; if (a.present) attPresent++; });
    });
    const attPct = attTotal ? Math.round((attPresent / attTotal) * 100) : null;
    return `
      <div class="st">Аналітика <button class="btn btn-s btn-sm" data-action="export-stats">Експорт</button></div>
      <p class="note-sm" style="margin-bottom:12px">Навантаження = Тривалість × RPE. Індивідуальний RPE — з відміток відвідування. Це планувальний показник, а не медична оцінка.</p>
      <div class="dg">
        <div class="sc"><div class="lb">Тренувань</div><div class="vl">${s.trainings.length}</div></div>
        <div class="sc"><div class="lb">Загальний час</div><div class="vl">${totalTime}<span style="font-size:13px"> хв</span></div></div>
        <div class="sc"><div class="lb">Сер. інтенсивність</div><div class="vl">${avgInt}</div></div>
        <div class="sc"><div class="lb">Тижневий Load</div><div class="vl">${weekLoad}</div></div>
        <div class="sc"><div class="lb">Відвідуваність</div><div class="vl">${attPct != null ? attPct + '%' : '—'}</div><div class="sb">${withAtt.length} сесій з відмітками</div></div>
      </div>
      <div class="card"><div class="ct">Навантаження (останні тренування)</div>
        <div class="cp"><div class="bc">${recent.length ? recent.map(t =>
          `<div class="bar" style="height:${Math.min(100, (LoadModel.sessionLoad(t.duration, t.intensity) / 10))}%" title="${sanitize(t.name)}: ${LoadModel.sessionLoad(t.duration, t.intensity)}"><span>${(t.date || '').slice(5)}</span></div>`
        ).join('') : '<div style="color:var(--muted)">Немає даних</div>'}</div></div>
      </div>
      <div class="card"><div class="ct">Сесії · відвідування
        <button type="button" class="btn btn-s btn-sm" style="margin-left:auto" data-view="trainings">До тренувань</button>
      </div>
        ${withAtt.length ? withAtt.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,8).map(t => {
          const vals = Object.values(t.attendance || {});
          const pr = vals.filter(a => a.present).length;
          return `<div class="li"><div class="inf"><div class="ti">${sanitize(t.name)}</div>
            <div class="me">${t.date || ''} · ${pr}/${vals.length} присутні · RPE ${t.intensity || '—'}</div></div>
            <button type="button" class="btn btn-s btn-sm" data-attendance-training="${t.id}">✎ Відмітки</button></div>`;
        }).join('') : '<div class="es">Ще немає відміток. Відкрийте тренування → «Відвідування».</div>'}
      </div>
      <div class="card"><div class="ct">Індивідуальне навантаження та відвідуваність</div>
        ${s.players.slice().sort((a, b) => {
          const la = LoadModel.playerLoad(s.trainings, a.id, 28);
          const lb = LoadModel.playerLoad(s.trainings, b.id, 28);
          return lb - la;
        }).map(p => {
          const rate = LoadModel.attendanceRate(s.trainings, p.id);
          const avgRpe = LoadModel.avgPlayerRpe(s.trainings, p.id);
          const pload = LoadModel.playerLoad(s.trainings, p.id, 28);
          const bar = avgRpe != null ? avgRpe : (p.load || 0);
          const lc = bar < 4 ? 'll' : (bar < 7 ? 'lm' : 'lh');
          const tg = p.telegramUsername ? ' · @' + sanitize(p.telegramUsername) : '';
          return `<div class="li"><div class="inf"><div class="ti">${p.number}. ${sanitize(p.firstName)} ${sanitize(p.lastName)}</div>
            <div class="me">${p.position} · готовність ${p.condition ?? p.readiness ?? '—'}%${tg}
              ${rate != null ? ' · відвідув. ' + rate + '%' : ''}
              ${avgRpe != null ? ' · сер. RPE ' + avgRpe : ''}
              ${pload ? ' · load 28д ' + pload : ''}
            </div></div>
            <div style="min-width:70px"><div class="lb2"><div class="lbf ${lc}" style="width:${Math.min(100, bar * 10)}%"></div></div></div>
          </div>`;
        }).join('')}
      </div>`;
  },

  settings() {
    try {
      const root = Store.get() || {};
      const s = root.settings || {};
      const rbac = s.rbac || { coaches: [], playerLinks: {} };
      const coachesStr = sanitize((rbac.coaches || []).join(', '));
      let linksStr = '{}';
      try { linksStr = sanitize(JSON.stringify(rbac.playerLinks || {})); } catch (_) { linksStr = '{}'; }
      const pri = s.primary || '#1a3a5c';
      const acc = s.accent || '#c8a84b';
      return `
      <div class="st">Налаштування</div>
      <div class="card"><div class="ct">Клуб</div>
        <div class="fg">
          <div class="fgr"><label>Назва</label><input id="setName" value="${sanitize(s.clubName || 'МЕТАЛІСТ ШТУТГАРТ')}"></div>
          <div class="fgr"><label>Скорочення</label><input id="setShort" value="${sanitize(s.clubShort || 'МШ')}" maxlength="4"></div>
          <div class="fgr"><label>Основний колір</label><input type="color" id="setPri" value="${pri}"></div>
          <div class="fgr"><label>Акцент</label><input type="color" id="setAcc" value="${acc}"></div>
          <div class="fgr"><label>Тривалість за замовч. (хв)</label><input type="number" id="setDur" value="${s.defaultDuration != null ? s.defaultDuration : 90}"></div>
          <div class="fgr"><label>Інтенсивність за замовч.</label><input type="number" id="setInt" value="${s.defaultIntensity != null ? s.defaultIntensity : 6}" min="1" max="10"></div>
          <div class="fgr full"><label>Логотип (завантажити зображення)</label>
            <input type="file" id="setLogo" accept="image/*">
            ${s.logoData ? '<p class="note-sm">Логотип завантажено</p>' : '<p class="note-sm">Placeholder: CLUB LOGO</p>'}
          </div>
          <div class="fgr"><label><input type="checkbox" id="setAuto" ${s.autosave !== false ? 'checked' : ''}> Автозбереження</label></div>
          <div class="fgr"><label><input type="checkbox" id="setSound" ${s.sound !== false ? 'checked' : ''}> Звук таймера</label></div>
        </div>
        <div class="fa"><button type="button" class="btn btn-p" data-action="save-settings">Зберегти</button></div>
      </div>
      <div class="card"><div class="ct">Дані</div>
        <div class="fa" style="flex-direction:column;align-items:stretch;gap:10px">
          <div class="data-io glass-io">
            <button type="button" class="btn btn-p data-io-btn" id="btnExportJson" data-io="export" data-action="export">Експорт JSON</button>
            <button type="button" class="btn btn-s data-io-btn" id="btnImportJson" data-io="import" data-action="import-trigger">Імпорт JSON</button>
          </div>
          <p class="note-sm">На iPhone: «Файли» / iCloud Drive. Перед імпортом створюється резервна копія.</p>
          <button type="button" class="btn btn-d" data-action="reset-all">Скинути все</button>
        </div>
      </div>
      <div class="card"><div class="ct">Ролі та Telegram (RBAC)</div>
        <p class="note-sm" style="margin-bottom:10px">Порожній список тренерів = повний доступ усім. Додайте Telegram ID або @username.</p>
        <div class="fgr full"><label>Тренері (через кому)</label>
          <input type="text" id="setCoaches" value="${coachesStr}" placeholder="123456789, @coach_nick">
        </div>
        <div class="fgr full"><label>Прив'язка гравців (JSON)</label>
          <textarea id="setPlayerLinks" rows="3" placeholder='{"123":"p01"}'>${linksStr}</textarea>
        </div>
        <p class="note-sm">Поточний користувач: <strong id="rbacMe">—</strong></p>
        <button type="button" class="btn btn-s" data-action="save-rbac">Зберегти ролі</button>
      </div>
      <div class="card"><div class="ct">Про застосунок</div>
        <p style="font-size:12px;color:var(--muted);line-height:1.6">
          Тренерська платформа · МЕТАЛІСТ ШТУТГАРТ<br>
          Schema v${typeof SCHEMA_VERSION !== 'undefined' ? SCHEMA_VERSION : 2} · localStorage · Telegram Cloud<br>
          Production-quality prototype
        </p>
      </div>`;
    } catch (e) {
      console.error('[Views.settings]', e);
      return `
        <div class="st">Налаштування</div>
        <div class="card">
          <div class="ct">Помилка відображення</div>
          <p class="note-sm">${sanitize(e && e.message ? e.message : String(e))}</p>
          <div class="data-io glass-io" style="margin-top:12px">
            <button type="button" class="btn btn-p data-io-btn" data-io="export" data-action="export">Експорт JSON</button>
            <button type="button" class="btn btn-s data-io-btn" data-io="import" data-action="import-trigger">Імпорт JSON</button>
          </div>
          <button type="button" class="btn btn-s" data-action="save-settings" style="margin-top:8px">Спробувати зберегти</button>
        </div>`;
    }
  },

  /* ─── 3-DEFENDER / MY EX / DIARY ─── */
/* ─── 3-DEFENDER TACTICAL CENTER ─── */
  back3() {
    const s = Store.get();
    const phasesHtml = Object.entries(BACK3.phases).map(([key, ph]) => `
      <div class="card" style="margin-bottom:12px">
        <div class="ct">${ph.label}</div>
        <div class="sg" style="flex-wrap:wrap;gap:6px">
          ${ph.items.map(it => `
            <button class="sb2" data-b3-phase="${it.scheme}" data-b3-name="${it.name}" title="${it.desc}"
              style="min-width:120px;text-align:left;padding:10px 12px">
              <strong>${it.name}</strong><br>
              <span style="font-size:10px;color:var(--muted)">${it.scheme}</span>
            </button>`).join('')}
        </div>
      </div>`).join('');

    const rolesHtml = Object.entries(BACK3.roles).map(([role, acts]) => `
      <div class="li"><div class="inf">
        <div class="ti">${role}</div>
        <div class="me">${acts.join(' · ')}</div>
      </div></div>`).join('');

    const rotHtml = BACK3.rotations.map(r => `
      <button class="sb2" data-b3-rot="${r.name}" style="text-align:left;padding:8px 10px;min-width:140px">
        <strong>${r.name}</strong><br><span style="font-size:10px;color:var(--muted)">${r.desc}</span>
      </button>`).join('');

    const ovHtml = BACK3.overloads.map(o => `
      <div class="sc" style="min-width:140px"><div class="lb">${o.name}</div><div class="sb">${o.desc}</div></div>`).join('');

    const formBtns = BACK3.formations.map(f =>
      `<button class="sb2 ${f.startsWith('3')?'':''}" data-scheme="${f}" style="font-weight:700">${f}</button>`).join('');

    return `
      <div class="st">3️⃣ 3-Defender Tactical Center
        <button class="btn btn-p btn-sm" data-action="open-default-board">Відкрити дошку (логотип)</button>
      </div>
      <p class="note-sm" style="margin-bottom:12px">Професійний workspace для back three: фази гри, ролі, ротації, overload. Одна команда — багато структур.</p>

      <div class="card"><div class="ct">Формації з 3 захисниками</div>
        <div class="sg">${formBtns}</div>
      </div>

      <div class="st" style="font-size:15px;margin-top:16px">Фази гри (одна команда → різні структури)</div>
      ${phasesHtml}

      <div class="card"><div class="ct">Ролі Back Three + Wing-backs</div>
        ${rolesHtml}
      </div>

      <div class="card"><div class="ct">Ротації</div>
        <div class="sg">${rotHtml}</div>
      </div>

      <div class="card"><div class="ct">Numerical superiority / Overload</div>
        <div class="dg">${ovHtml}</div>
      </div>

      <div class="card"><div class="ct">Швидкі сценарії на дошці</div>
        <div class="sg">
          <button class="btn btn-p" data-b3-phase="3-2-build" data-b3-name="Build-up 3-2">▶ Build-up 3-2</button>
          <button class="btn btn-p" data-b3-phase="3-2-5-atk" data-b3-name="Attack 3-2-5">▶ Attack 3-2-5</button>
          <button class="btn btn-p" data-b3-phase="5-2-3" data-b3-name="Mid block 5-2-3">▶ Mid block</button>
          <button class="btn btn-p" data-b3-phase="3-4-3" data-b3-name="High press 3-4-3">▶ High press</button>
          <button class="btn btn-s" data-action="save-b3-anim">💾 Зберегти анімацію фази</button>
        </div>
      </div>`;
  },

  /* ─── MY EXERCISES ─── */
  myex() {
    const list = Store.get().myExercises || [];
    return `
      <div class="st">Мої вправи
        <button class="btn btn-p btn-sm" data-action="new-myex">+ Створити</button>
        <button class="btn btn-s btn-sm" data-action="myex-from-board">З дошки</button>
      </div>
      <p class="note-sm">Власні вправи з тактичною дошкою та анімацією. Можна додати в тренування.</p>
      ${list.length ? list.map(e => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <strong>${sanitize(e.name)}</strong>
              <div class="me">${e.category || '—'} · ${e.duration || 0}хв · RPE ${e.intensity || '—'}
                ${(e.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}
              </div>
              <div class="me">${sanitize(e.objective || '')}</div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              ${e.board ? `<button class="btn btn-s btn-sm" data-load-myex-board="${e.id}">⚽ Дошка</button>` : ''}
              ${e.animationId ? `<button class="btn btn-s btn-sm" data-play-anim="${e.animationId}">▶ Anim</button>` : ''}
              <button class="btn btn-s btn-sm" data-add-myex-tr="${e.id}">+ У тренування</button>
              <button class="btn btn-d btn-sm" data-del-myex="${e.id}">✕</button>
            </div>
          </div>
          ${e.coachingPoints ? `<div class="note-sm" style="margin-top:6px"><b>CP:</b> ${sanitize(e.coachingPoints)}</div>` : ''}
        </div>`).join('') : '<div class="es">Немає власних вправ. Створіть або збережіть з дошки.</div>'}`;
  },

  /* ─── COACH DIARY ─── */
  diary() {
    const list = (Store.get().diary || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const cats = ['Match Reflection','Training Reflection','Tactical Idea','Player Observation','Team Observation','Problem','Solution','Goal','Meeting','Personal Note'];
    return `
      <div class="st">📓 Щоденник тренера
        <button class="btn btn-p btn-sm" data-action="new-diary">+ Запис</button>
      </div>
      <p class="note-sm">Особисті нотатки, ідеї, спостереження. Можна прив\'язати до гравця, матчу, сцени на дошці.</p>
      <div class="sg" style="margin-bottom:12px;flex-wrap:wrap">
        ${cats.map(c => `<button class="sb2" data-diary-filter="${c}" style="font-size:11px">${c}</button>`).join('')}
        <button class="sb2" data-diary-filter="all">Усі</button>
      </div>
      <div id="diaryList">
      ${list.length ? list.map(d => `
        <div class="card" data-diary-cat="${sanitize(d.category||'')}">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <div>
              <div class="me">${d.date || ''} · <span style="color:var(--accent)">${sanitize(d.category||'')}</span>
                ${d.mood ? ' · ' + d.mood : ''}
              </div>
              <strong>${sanitize(d.title || 'Без назви')}</strong>
              <div style="font-size:13px;margin-top:4px;white-space:pre-wrap">${sanitize(d.text || '')}</div>
              ${d.playerId ? `<div class="me">👤 Гравець: ${d.playerId}</div>` : ''}
              ${d.tags && d.tags.length ? `<div class="me">${d.tags.map(t=>'#'+t).join(' ')}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${d.board ? `<button class="btn btn-s btn-sm" data-load-diary-board="${d.id}">⚽</button>` : ''}
              <button class="btn btn-s btn-sm" data-edit-diary="${d.id}">✎</button>
              <button class="btn btn-d btn-sm" data-del-diary="${d.id}">✕</button>
            </div>
          </div>
        </div>`).join('') : '<div class="es">Щоденник порожній. Додайте перший запис.</div>'}
      </div>`;
  },
};

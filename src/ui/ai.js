/** Extracted module: src/ui/ai.js lines 1819-2013 — DO NOT rewrite business logic */
const AIService = {
  generateTraining() {
    const s = Store.get();
    const t = {
      id: uid(), name: 'AI Тренування ' + fmtDate(new Date()), date: today(), time: '10:00',
      duration: 90, intensity: 7, load: 7, status: 'draft',
      mainGoal: 'Комплексна техніко-тактична підготовка', place: 'Тренувальна база', surface: 'Газон',
      playersCount: 16, comment: 'Згенеровано AIService (демо)',
      structure: [
        { id: uid(), title: 'Розминка з м\'ячем', type: 'warmup', duration: 12, intensity: 3 },
        { id: uid(), title: 'Активація / Координація', type: 'activation', duration: 8, intensity: 4 },
        { id: uid(), title: 'Технічний блок', type: 'tech', duration: 18, intensity: 6 },
        { id: uid(), title: 'Тактичний блок', type: 'tactical', duration: 20, intensity: 7 },
        { id: uid(), title: 'Ігровий блок 7v7', type: 'game', duration: 20, intensity: 8 },
        { id: uid(), title: 'Заминка', type: 'cooldown', duration: 10, intensity: 2 }
      ]
    };
    t.duration = t.structure.reduce((a, b) => a + b.duration, 0);
    s.trainings.push(t);
    // add calendar event
    s.calendar.push({ id: uid(), type: 'TRAINING', title: t.name, date: t.date, time: t.time, trainingId: t.id });
    StorageManager.save();
    Toast.show('AI створив тренування', 'ok');
    App.navigate('trainings');
  },
  generateExercise(cat) {
    const templates = {
      warmup: { name: 'AI Розминка', category: 'warmup', duration: 15, intensity: 3, objective: 'Підготовка' },
      tech: { name: 'AI Технічна — Квадрат 5v2', category: 'passing', duration: 15, intensity: 6, objective: 'Утримання' },
      tactical: { name: 'AI Тактична — Пресинг 6v4', category: 'pressing', duration: 20, intensity: 8, objective: 'Відбір' },
      gk: { name: 'AI Воротарі', category: 'goalkeeping', duration: 25, intensity: 6, objective: 'Реакція' }
    };
    const t = templates[cat] || templates.tech;
    Store.get().exercises.push({
      id: uid(), ...t, description: 'AI-генерована вправа', players: 10, area: 'Половина',
      equipment: ['м\'ячі', 'фішки'], instructions: '', coachingPoints: '', progression: '', regression: '', boardSetup: null
    });
    StorageManager.save();
    Toast.show('AI створив вправу', 'ok');
    App.navigate('exercises');
  },
  optimizeLoad() {
    Store.get().players.forEach(p => {
      if (p.status === 'available') p.load = clamp((p.load || 5) + (Math.random() > 0.5 ? 1 : -1), 0, 10);
    });
    StorageManager.save();
    Toast.show('Навантаження оптимізовано (демо)', 'ok');
    if (Store.get().ui.view === 'players') App.renderCurrent();
  },
  analyzeMicrocycle() {
    const s = Store.get();
    const weekAgo = Date.now() - 7 * 86400000;
    const count = s.trainings.filter(t => new Date(t.date).getTime() >= weekAgo).length;
    const avg = LoadModel.teamAvgLoad(s.players).toFixed(1);
    Toast.show(`Мікроцикл: ${count} трен. / 7д. Сер. load гравців: ${avg}/10`, 'ok');
  }
};

/* ─── APP CONTROLLER ────────────────────────────────────── */
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
        <button class="btn btn-p btn-sm" data-view="board">Відкрити дошку</button>
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



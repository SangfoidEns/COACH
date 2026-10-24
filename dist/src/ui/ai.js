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

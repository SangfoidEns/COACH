/** Session load & attendance analytics */
const LoadModel = {
  sessionLoad(duration, intensity) {
    return Math.round((+duration || 0) * (+intensity || 0));
  },

  weeklyLoad(trainings, refDate) {
    const d = refDate ? new Date(refDate) : new Date();
    const to = d.toISOString().slice(0, 10);
    const fromD = new Date(d);
    fromD.setDate(fromD.getDate() - 6);
    const from = fromD.toISOString().slice(0, 10);
    return (trainings || []).filter(t => t.date >= from && t.date <= to)
      .reduce((a, t) => a + this.sessionLoad(t.duration, t.intensity), 0);
  },

  /** % відвідувань гравця серед проведених (done) тренувань */
  attendanceRate(trainings, playerId) {
    const done = (trainings || []).filter(t => t.status === 'done' || (t.attendance && Object.keys(t.attendance).length));
    if (!done.length) return null;
    let present = 0, total = 0;
    done.forEach(t => {
      const a = t.attendance && t.attendance[playerId];
      if (a == null) return;
      total++;
      if (a.present) present++;
    });
    if (!total) return null;
    return Math.round((present / total) * 100);
  },

  /** Середній індивідуальний RPE (лише коли був присутній) */
  avgPlayerRpe(trainings, playerId) {
    const vals = [];
    (trainings || []).forEach(t => {
      const a = t.attendance && t.attendance[playerId];
      if (a && a.present && a.intensity != null) vals.push(+a.intensity);
    });
    if (!vals.length) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
  },

  /** Індивідуальний load = sum(duration × individual RPE) за період */
  playerLoad(trainings, playerId, days) {
    const cut = new Date();
    cut.setDate(cut.getDate() - (days || 28));
    const from = cut.toISOString().slice(0, 10);
    let sum = 0;
    (trainings || []).forEach(t => {
      if (t.date < from) return;
      const a = t.attendance && t.attendance[playerId];
      if (!a || !a.present) return;
      const rpe = a.intensity != null ? +a.intensity : (+t.intensity || 0);
      sum += this.sessionLoad(t.duration, rpe);
    });
    return sum;
  },

  /** Оновити player.load (0–10) з останніх відвідувань */
  recomputePlayerLoads(players, trainings) {
    (players || []).forEach(p => {
      const avg = this.avgPlayerRpe(trainings, p.id);
      if (avg != null) p.load = Math.min(10, Math.round(avg));
    });
  }
};

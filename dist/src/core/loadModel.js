/** Session load & attendance analytics */
const LoadModel = {
  sessionLoad(duration, intensity) {
    return Math.round((+duration || 0) * (+intensity || 0));
  },

  /** ISO date сьогодні (локальна) */
  todayStr(refDate) {
    const d = refDate ? new Date(refDate) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  },

  /**
   * Лише тренування, які вже відбулися (дата ≤ сьогодні)
   * і не скасовані. Майбутні planned/draft не враховуються.
   */
  pastTrainings(trainings, refDate) {
    const today = this.todayStr(refDate);
    return (trainings || []).filter(t => {
      if (!t || !t.date) return false;
      if (t.status === 'cancelled' || t.status === 'canceled') return false;
      return String(t.date) <= today;
    });
  },

  /** Проведені (done) або з відмітками відвідування, у минулому */
  completedTrainings(trainings, refDate) {
    return this.pastTrainings(trainings, refDate).filter(t =>
      t.status === 'done' || (t.attendance && Object.keys(t.attendance).length)
    );
  },

  weeklyLoad(trainings, refDate) {
    const d = refDate ? new Date(refDate) : new Date();
    const to = this.todayStr(d);
    const fromD = new Date(d);
    fromD.setDate(fromD.getDate() - 6);
    const from = this.todayStr(fromD);
    // тільки минулі/сьогоднішні, не майбутні
    return this.pastTrainings(trainings, d)
      .filter(t => t.date >= from && t.date <= to)
      .reduce((a, t) => a + this.sessionLoad(t.duration, t.intensity), 0);
  },

  /** % відвідувань серед проведених у минулому */
  attendanceRate(trainings, playerId) {
    const done = this.completedTrainings(trainings);
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

  avgPlayerRpe(trainings, playerId) {
    const vals = [];
    this.pastTrainings(trainings).forEach(t => {
      const a = t.attendance && t.attendance[playerId];
      if (a && a.present && a.intensity != null) vals.push(+a.intensity);
    });
    if (!vals.length) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
  },

  playerLoad(trainings, playerId, days) {
    days = days || 28;
    const today = this.todayStr();
    const fromD = new Date();
    fromD.setDate(fromD.getDate() - (days - 1));
    const from = this.todayStr(fromD);
    let sum = 0;
    this.pastTrainings(trainings).forEach(t => {
      if (t.date < from || t.date > today) return;
      const a = t.attendance && t.attendance[playerId];
      if (a && a.present) {
        const rpe = a.intensity != null ? +a.intensity : (+t.intensity || 0);
        sum += this.sessionLoad(t.duration, rpe);
      }
    });
    return sum;
  },

  recomputePlayerLoads(players, trainings) {
    (players || []).forEach(p => {
      const load = this.playerLoad(trainings, p.id, 28);
      p.load28 = load;
    });
  },

  /** Дані для графіка: відвідуваність по кожному минулому тренуванню */
  attendanceBySession(trainings, refDate) {
    return this.pastTrainings(trainings, refDate)
      .filter(t => t.attendance && Object.keys(t.attendance).length)
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(t => {
        const vals = Object.values(t.attendance || {});
        const pr = vals.filter(a => a && a.present).length;
        const total = vals.length || 1;
        return {
          id: t.id,
          name: t.name || 'Тренування',
          date: t.date,
          present: pr,
          total,
          pct: Math.round((pr / total) * 100)
        };
      });
  },

  /** Підсумок: кількість минулих, години, сер. RPE, загальна відвідуваність */
  teamSummary(trainings, players, refDate) {
    const past = this.pastTrainings(trainings, refDate);
    const totalMin = past.reduce((a, t) => a + (+t.duration || 0), 0);
    const withRpe = past.filter(t => t.intensity != null);
    const avgInt = withRpe.length
      ? Math.round((withRpe.reduce((a, t) => a + (+t.intensity || 0), 0) / withRpe.length) * 10) / 10
      : 0;
    const sessions = this.attendanceBySession(trainings, refDate);
    const overallAtt = sessions.length
      ? Math.round(sessions.reduce((a, s) => a + s.pct, 0) / sessions.length)
      : null;
    return {
      count: past.length,
      totalMin,
      avgInt,
      weekLoad: this.weeklyLoad(trainings, refDate),
      overallAtt,
      sessionsWithAtt: sessions.length
    };
  }
};

if (typeof window !== 'undefined') window.LoadModel = LoadModel;

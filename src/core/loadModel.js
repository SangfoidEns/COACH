/** Extracted module: src/core/loadModel.js lines 1477-1490 — DO NOT rewrite business logic */
const LoadModel = {
  sessionLoad(duration, rpe) { return (duration || 0) * (rpe || 0); },
  weeklyLoad(trainings) {
    const weekAgo = Date.now() - 7 * 86400000;
    return trainings.filter(t => new Date(t.date).getTime() >= weekAgo)
      .reduce((s, t) => s + this.sessionLoad(t.duration, t.intensity || t.load), 0);
  },
  teamAvgLoad(players) {
    if (!players.length) return 0;
    return players.reduce((s, p) => s + (p.load || 0), 0) / players.length;
  }
};

/* ─── VIEWS ─────────────────────────────────────────────── */

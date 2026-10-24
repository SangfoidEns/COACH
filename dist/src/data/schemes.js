/** Extracted module: src/data/schemes.js lines 161-239 — DO NOT rewrite business logic */
/* ─── 3-DEFENDER TACTICAL CENTER DATA ───────────────────── */
const BACK3 = {
  formations: ['3-4-3','3-4-2-1','3-5-2','3-1-4-2','3-2-4-1','3-2-2-3','3-3-2-2','3-4-1-2','3-2-5-atk','3-2-build'],
  phases: {
    'in-possession': {
      label: 'З м\'ячем',
      items: [
        { id: 'build-up', name: 'Build-up', scheme: '3-2-build', desc: 'GK + 3CB + 2 pivot. Розтягування першої лінії пресингу.' },
        { id: 'progression', name: 'Progression', scheme: '3-2-4-1', desc: 'Прогрес через half-spaces, WB високо.' },
        { id: 'final-third', name: 'Final third', scheme: '3-2-5-atk', desc: '3-2-5: overload box, WB у штрафний.' },
        { id: 'chance', name: 'Chance creation', scheme: '3-2-5-atk', desc: 'Third-man runs, cut-backs, far-post.' }
      ]
    },
    'out-possession': {
      label: 'Без м\'яча',
      items: [
        { id: 'high-press', name: 'High press', scheme: '3-4-3', desc: 'Front 3 + midfield trap, CB ready to step.' },
        { id: 'mid-block', name: 'Mid block', scheme: '5-2-3', desc: 'WB drop → back five, compact mid.' },
        { id: 'low-block', name: 'Low block', scheme: '5-4-1', desc: 'Deep 5-4-1, channels closed.' },
        { id: 'press-trap', name: 'Pressing trap', scheme: '3-4-3', desc: 'Force wide, trap near touchline.' }
      ]
    },
    transitions: {
      label: 'Переходи',
      items: [
        { id: 'counterpress', name: 'Counterpress', scheme: '3-4-3', desc: '5 сек на відбір після втрати.' },
        { id: 'counter', name: 'Counterattack', scheme: '3-2-5-atk', desc: 'Vertical pass + WB burst.' },
        { id: 'rest-def', name: 'Rest defense', scheme: '3-2-build', desc: '3+2 balance behind ball.' },
        { id: 'neg-trans', name: 'Negative transition', scheme: '5-2-3', desc: 'Immediate shape to 5-2-3.' }
      ]
    }
  },
  roles: {
    LCB: ['cover', 'step out', 'wide cover', 'defend channel', 'build-up pass'],
    CB:  ['central cover', 'sweep', 'organize line', 'step into midfield', 'switch play'],
    RCB: ['cover', 'step out', 'wide cover', 'defend channel', 'build-up pass'],
    LWB: ['attacking WB', 'inverted WB', 'wide WB', 'support WB', 'defensive WB'],
    RWB: ['attacking WB', 'inverted WB', 'wide WB', 'support WB', 'defensive WB']
  },
  rotations: [
    { name: 'LCB → wide', from: 'LCB', to: 'wide', desc: 'LCB opens channel, LWB inverts' },
    { name: 'RCB → wide', from: 'RCB', to: 'wide', desc: 'RCB opens channel, RWB inverts' },
    { name: 'CB → midfield', from: 'CB', to: 'mid', desc: 'CB steps into pivot, creates +1' },
    { name: 'WB → inside', from: 'WB', to: 'half-space', desc: 'Inverted wing-back in half-space' },
    { name: 'WB → high', from: 'WB', to: 'high', desc: 'Attacking overlap / underlap' },
    { name: 'ST drop', from: 'ST', to: 'link', desc: '9 drops, 10 occupies half-space' }
  ],
  overloads: [
    { name: '3+2 vs 2', desc: 'Build-up numerical +1 against front press' },
    { name: '3+2 vs 3', desc: 'Need third-man or GK involvement' },
    { name: '5v4 final third', desc: 'Attacking overload in box' },
    { name: 'Isolation far side', desc: 'Overload left → isolate right WB 1v1' }
  ]
};

const SCHEMES = {
  /* —— 4-back —— */
  '4-3-3': [[1,.5,.92],[2,.2,.75],[3,.4,.78],[4,.6,.78],[5,.8,.75],[6,.3,.55],[8,.5,.58],[10,.7,.55],[7,.18,.3],[9,.5,.22],[11,.82,.3]],
  '4-2-3-1': [[1,.5,.92],[2,.2,.75],[3,.4,.78],[4,.6,.78],[5,.8,.75],[6,.35,.6],[8,.65,.6],[7,.2,.4],[10,.5,.42],[11,.8,.4],[9,.5,.22]],
  '4-4-2': [[1,.5,.92],[2,.2,.75],[3,.4,.78],[4,.6,.78],[5,.8,.75],[6,.2,.52],[8,.4,.55],[10,.6,.55],[7,.8,.52],[9,.4,.25],[11,.6,.25]],
  '4-1-4-1': [[1,.5,.92],[2,.2,.75],[3,.4,.78],[4,.6,.78],[5,.8,.75],[6,.5,.62],[7,.18,.42],[8,.38,.45],[10,.62,.45],[11,.82,.42],[9,.5,.22]],
  '4-3-2-1': [[1,.5,.92],[2,.2,.75],[3,.4,.78],[4,.6,.78],[5,.8,.75],[6,.3,.58],[8,.5,.6],[10,.7,.58],[7,.35,.38],[11,.65,.38],[9,.5,.2]],
  '5-3-2': [[1,.5,.92],[2,.1,.72],[3,.3,.78],[4,.5,.8],[5,.7,.78],[6,.9,.72],[8,.3,.52],[10,.5,.55],[7,.7,.52],[9,.4,.25],[11,.6,.25]],
  '5-4-1': [[1,.5,.92],[2,.1,.72],[3,.3,.78],[4,.5,.8],[5,.7,.78],[6,.9,.72],[7,.18,.5],[8,.38,.52],[10,.62,.52],[11,.82,.5],[9,.5,.22]],
  /* —— 3-DEFENDER CORE —— */
  '3-4-3': [[1,.5,.92],[3,.28,.8],[4,.5,.82],[5,.72,.8],[2,.12,.55],[6,.38,.55],[8,.62,.55],[7,.88,.55],[11,.18,.28],[9,.5,.2],[10,.82,.28]],
  '3-4-2-1': [[1,.5,.92],[3,.28,.8],[4,.5,.82],[5,.72,.8],[2,.12,.55],[6,.38,.58],[8,.62,.58],[7,.88,.55],[10,.35,.35],[11,.65,.35],[9,.5,.18]],
  '3-5-2': [[1,.5,.92],[3,.28,.8],[4,.5,.82],[5,.72,.8],[2,.1,.55],[6,.32,.55],[8,.5,.58],[10,.68,.55],[7,.9,.55],[9,.38,.22],[11,.62,.22]],
  '3-1-4-2': [[1,.5,.92],[3,.28,.8],[4,.5,.82],[5,.72,.8],[6,.5,.65],[2,.12,.5],[8,.35,.48],[10,.65,.48],[7,.88,.5],[9,.38,.22],[11,.62,.22]],
  '3-2-4-1': [[1,.5,.92],[3,.28,.8],[4,.5,.82],[5,.72,.8],[6,.38,.62],[8,.62,.62],[2,.12,.42],[10,.35,.4],[7,.65,.4],[11,.88,.42],[9,.5,.18]],
  '3-2-2-3': [[1,.5,.92],[3,.28,.8],[4,.5,.82],[5,.72,.8],[6,.38,.6],[8,.62,.6],[10,.35,.4],[7,.65,.4],[11,.18,.22],[9,.5,.18],[2,.82,.22]],
  '3-3-2-2': [[1,.5,.92],[3,.28,.8],[4,.5,.82],[5,.72,.8],[2,.2,.58],[6,.5,.6],[7,.8,.58],[10,.35,.38],[8,.65,.38],[9,.38,.2],[11,.62,.2]],
  '3-4-1-2': [[1,.5,.92],[3,.28,.8],[4,.5,.82],[5,.72,.8],[2,.12,.55],[6,.38,.55],[8,.62,.55],[7,.88,.55],[10,.5,.38],[9,.35,.2],[11,.65,.2]],
  /* —— phases / blocks —— */
  '5-2-3': [[1,.5,.92],[2,.1,.75],[3,.3,.8],[4,.5,.82],[5,.7,.8],[6,.9,.75],[8,.35,.55],[10,.65,.55],[7,.2,.3],[9,.5,.25],[11,.8,.3]],
  '3-2-5-atk': [[1,.5,.92],[3,.3,.82],[4,.5,.85],[5,.7,.82],[6,.38,.62],[8,.62,.62],[2,.08,.35],[10,.28,.32],[9,.5,.18],[7,.72,.32],[11,.92,.35]],
  '3-2-build': [[1,.5,.88],[3,.25,.75],[4,.5,.78],[5,.75,.75],[6,.35,.55],[8,.65,.55],[2,.15,.4],[10,.4,.38],[9,.5,.22],[7,.6,.38],[11,.85,.4]]
};


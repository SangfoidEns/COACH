/**
 * TacticalBoardEngine — Canvas 2D, 60fps, unlimited pointer drag.
 *
 * World coords: x,y in [0,1] relative to full pitch.
 * Camera: {x, y, zoom} applied at render time only.
 * Drag: setPointerCapture + offset → player follows finger anywhere, no distance limit.
 */
import { clamp, uid, dist } from '../utils/math.js';

const PITCH_W = 1050;
const PITCH_H = 680; // landscape internal buffer; we flip for portrait view via CSS

export class TacticalBoardEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.objects = [];
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.tool = 'select';
    this.selectedId = null;
    this.history = [];
    this.historyIdx = -1;

    // Drag state
    this.drag = null; // { id, offsetX, offsetY, pointerId }
    this.pointers = new Map();
    this.drawing = null; // { type, start, points }
    this.polygonPts = [];

    this.onChange = options.onChange || (() => {});
    this.raf = null;
    this.needsRender = true;
    this.anim = { playing: false, t: 0, speed: 1, duration: 5 };

    this._bind();
    this._resize();
    this.pushHistory();
    this._loop();
  }

  /* ── Input ── */
  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => this._onDown(e), { passive: false });
    c.addEventListener('pointermove', (e) => this._onMove(e), { passive: false });
    c.addEventListener('pointerup', (e) => this._onUp(e));
    c.addEventListener('pointercancel', (e) => this._onUp(e));
    c.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.viewW = w;
    this.viewH = h;
    this.needsRender = true;
  }

  /** Screen (client) → world [0,1] */
  screenToWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const lx = (clientX - r.left) / Math.max(1, r.width);
    const ly = (clientY - r.top) / Math.max(1, r.height);
    const z = this.camera.zoom;
    return {
      x: clamp((lx - 0.5) / z + 0.5 + this.camera.x, -0.05, 1.05),
      y: clamp((ly - 0.5) / z + 0.5 + this.camera.y, -0.05, 1.05),
    };
  }

  worldToScreen(wx, wy) {
    const z = this.camera.zoom;
    const sx = ((wx - this.camera.x - 0.5) * z + 0.5) * this.viewW;
    const sy = ((wy - this.camera.y - 0.5) * z + 0.5) * this.viewH;
    return { x: sx * this.dpr, y: sy * this.dpr };
  }

  /** Hit-test tokens (generous 48px radius in screen space) */
  hitTest(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const mx = (clientX - r.left) * this.dpr;
    const my = (clientY - r.top) * this.dpr;
    const hitR = 28 * this.dpr;
    let best = null;
    let bestD = hitR;
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (o.locked || o.visible === false) continue;
      if (!['player', 'opponent', 'ball', 'cone', 'mannequin'].includes(o.type)) continue;
      const p = this.worldToScreen(o.x, o.y);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  _onDown(e) {
    e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch start
    if (this.pointers.size >= 2) {
      this.drag = null;
      this.drawing = null;
      const pts = [...this.pointers.values()];
      this._pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        zoom: this.camera.zoom,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
        camX: this.camera.x,
        camY: this.camera.y,
      };
      return;
    }

    // Middle mouse / space pan
    if (e.button === 1) {
      this._pan = { x: e.clientX, y: e.clientY, camX: this.camera.x, camY: this.camera.y };
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);

    // ── IMMEDIATE DRAG ──
    if (this.tool === 'select' || this.tool === 'move') {
      const hit = this.hitTest(e.clientX, e.clientY);
      if (hit) {
        this.selectedId = hit.id;
        this.drag = {
          id: hit.id,
          offsetX: world.x - hit.x,
          offsetY: world.y - hit.y,
          pointerId: e.pointerId,
        };
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {}
        this.needsRender = true;
        return;
      }
      this.selectedId = null;
      this.needsRender = true;
      return;
    }

    // Place objects
    if (this.tool === 'player' || this.tool === 'opponent') {
      const n = this.objects.filter((o) => o.type === 'player' || o.type === 'opponent').length + 1;
      this.objects.push({
        id: uid(),
        type: this.tool,
        x: world.x,
        y: world.y,
        number: n,
        name: '',
        team: this.tool === 'opponent' ? 'opp' : 'own',
        rotation: 0,
        scale: 1,
        visible: true,
        locked: false,
        keyframes: [],
      });
      this.pushHistory();
      this.needsRender = true;
      return;
    }

    if (this.tool === 'ball') {
      this.objects = this.objects.filter((o) => o.type !== 'ball');
      this.objects.push({
        id: uid(),
        type: 'ball',
        x: world.x,
        y: world.y,
        visible: true,
        locked: false,
        keyframes: [],
      });
      this.pushHistory();
      this.needsRender = true;
      return;
    }

    if (this.tool === 'cone' || this.tool === 'mannequin') {
      this.objects.push({
        id: uid(),
        type: this.tool,
        x: world.x,
        y: world.y,
        rotation: 0,
        visible: true,
        locked: false,
      });
      this.pushHistory();
      this.needsRender = true;
      return;
    }

    if (this.tool === 'polygon') {
      this.polygonPts.push({ x: world.x, y: world.y });
      if (this.polygonPts.length >= 3) {
        const a = this.polygonPts[this.polygonPts.length - 1];
        const b = this.polygonPts[this.polygonPts.length - 2];
        if (dist(a, b) < 0.02) {
          this.polygonPts.pop();
          this._closePolygon();
        }
      }
      this.needsRender = true;
      return;
    }

    if (
      [
        'pass',
        'run',
        'dribble',
        'shot',
        'press',
        'arrow',
        'zone',
        'circle',
        'freehand',
        'line',
      ].includes(this.tool)
    ) {
      this.drawing = {
        type: this.tool,
        start: world,
        points: [{ x: world.x, y: world.y }],
        pointerId: e.pointerId,
      };
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (this.tool === 'text') {
      const label = prompt('Текст:');
      if (label) {
        this.objects.push({
          id: uid(),
          type: 'text',
          x: world.x,
          y: world.y,
          label,
          visible: true,
          locked: false,
        });
        this.pushHistory();
        this.needsRender = true;
      }
    }
  }

  _onMove(e) {
    e.preventDefault();
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch zoom + pan
    if (this.pointers.size >= 2 && this._pinch) {
      const pts = [...this.pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this._pinch.dist > 0) {
        this.camera.zoom = clamp(this._pinch.zoom * (d / this._pinch.dist), 0.4, 5);
      }
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const dx = (mx - this._pinch.midX) / this.viewW / this.camera.zoom;
      const dy = (my - this._pinch.midY) / this.viewH / this.camera.zoom;
      this.camera.x = this._pinch.camX - dx;
      this.camera.y = this._pinch.camY - dy;
      this.needsRender = true;
      return;
    }

    if (this._pan) {
      const dx = (e.clientX - this._pan.x) / this.viewW / this.camera.zoom;
      const dy = (e.clientY - this._pan.y) / this.viewH / this.camera.zoom;
      this.camera.x = this._pan.camX - dx;
      this.camera.y = this._pan.camY - dy;
      this.needsRender = true;
      return;
    }

    // ── DRAG: unlimited, follows pointer ──
    if (this.drag && this.drag.pointerId === e.pointerId) {
      const world = this.screenToWorld(e.clientX, e.clientY);
      const obj = this.objects.find((o) => o.id === this.drag.id);
      if (obj) {
        // NO distance limit — clamp only to slight pad outside pitch
        obj.x = clamp(world.x - this.drag.offsetX, -0.02, 1.02);
        obj.y = clamp(world.y - this.drag.offsetY, -0.02, 1.02);
        this.needsRender = true;
      }
      return;
    }

    if (this.drawing && this.drawing.pointerId === e.pointerId) {
      const world = this.screenToWorld(e.clientX, e.clientY);
      this.drawing.points.push({ x: world.x, y: world.y });
      this.drawing.current = world;
      this.needsRender = true;
    }
  }

  _onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this._pinch = null;
    if (this._pan) this._pan = null;

    if (this.drag && this.drag.pointerId === e.pointerId) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {}
      this.drag = null;
      this.pushHistory();
      this.onChange();
      return;
    }

    if (this.drawing && this.drawing.pointerId === e.pointerId) {
      const d = this.drawing;
      const end = d.current || d.start;
      if (['pass', 'run', 'dribble', 'shot', 'press', 'arrow', 'line'].includes(d.type)) {
        if (dist(d.start, end) > 0.01) {
          this.objects.push({
            id: uid(),
            type: d.type,
            x: d.start.x,
            y: d.start.y,
            x2: end.x,
            y2: end.y,
            visible: true,
            locked: false,
          });
          this.pushHistory();
        }
      } else if (d.type === 'zone') {
        const x = Math.min(d.start.x, end.x);
        const y = Math.min(d.start.y, end.y);
        const w = Math.abs(end.x - d.start.x);
        const h = Math.abs(end.y - d.start.y);
        if (w > 0.02 && h > 0.02) {
          this.objects.push({
            id: uid(),
            type: 'zone',
            shape: 'rect',
            x,
            y,
            w,
            h,
            fill: 'rgba(200,168,75,0.3)',
            label: '',
            visible: true,
            locked: false,
          });
          this.pushHistory();
        }
      } else if (d.type === 'circle') {
        const r = dist(d.start, end);
        if (r > 0.015) {
          this.objects.push({
            id: uid(),
            type: 'zone',
            shape: 'circle',
            x: d.start.x,
            y: d.start.y,
            r,
            fill: 'rgba(52,152,219,0.25)',
            label: '',
            visible: true,
            locked: false,
          });
          this.pushHistory();
        }
      } else if (d.type === 'freehand' && d.points.length > 4) {
        this.objects.push({
          id: uid(),
          type: 'zone',
          shape: 'polygon',
          points: d.points.slice(),
          fill: 'rgba(46,204,113,0.25)',
          label: '',
          visible: true,
          locked: false,
        });
        this.pushHistory();
      }
      this.drawing = null;
      this.onChange();
      this.needsRender = true;
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = clamp(this.camera.zoom * factor, 0.4, 5);
    this.needsRender = true;
  }

  _closePolygon() {
    if (this.polygonPts.length < 3) return;
    this.objects.push({
      id: uid(),
      type: 'zone',
      shape: 'polygon',
      points: this.polygonPts.slice(),
      fill: 'rgba(200,168,75,0.3)',
      label: 'Zone',
      visible: true,
      locked: false,
    });
    this.polygonPts = [];
    this.pushHistory();
    this.onChange();
    this.needsRender = true;
  }

  /* ── History ── */
  pushHistory() {
    const snap = JSON.stringify({
      objects: this.objects,
      camera: this.camera,
    });
    this.history = this.history.slice(0, this.historyIdx + 1);
    this.history.push(snap);
    this.historyIdx = this.history.length - 1;
    // soft soft-cap only for memory (not a feature limit on objects)
    if (this.history.length > 100) {
      this.history.shift();
      this.historyIdx--;
    }
  }

  undo() {
    if (this.historyIdx <= 0) return;
    this.historyIdx--;
    this._restore(this.history[this.historyIdx]);
  }

  redo() {
    if (this.historyIdx >= this.history.length - 1) return;
    this.historyIdx++;
    this._restore(this.history[this.historyIdx]);
  }

  _restore(snap) {
    try {
      const d = JSON.parse(snap);
      this.objects = d.objects || [];
      if (d.camera) this.camera = d.camera;
      this.needsRender = true;
      this.onChange();
    } catch {}
  }

  /* ── Formations ── */
  applyFormation(name) {
    const F = {
      '4-3-3': [
        [1, 0.5, 0.92],
        [2, 0.2, 0.75],
        [3, 0.4, 0.78],
        [4, 0.6, 0.78],
        [5, 0.8, 0.75],
        [6, 0.3, 0.55],
        [8, 0.5, 0.58],
        [10, 0.7, 0.55],
        [7, 0.18, 0.3],
        [9, 0.5, 0.22],
        [11, 0.82, 0.3],
      ],
      '4-2-3-1': [
        [1, 0.5, 0.92],
        [2, 0.2, 0.75],
        [3, 0.4, 0.78],
        [4, 0.6, 0.78],
        [5, 0.8, 0.75],
        [6, 0.35, 0.6],
        [8, 0.65, 0.6],
        [7, 0.2, 0.4],
        [10, 0.5, 0.42],
        [11, 0.8, 0.4],
        [9, 0.5, 0.22],
      ],
      '4-4-2': [
        [1, 0.5, 0.92],
        [2, 0.2, 0.75],
        [3, 0.4, 0.78],
        [4, 0.6, 0.78],
        [5, 0.8, 0.75],
        [6, 0.2, 0.52],
        [8, 0.4, 0.55],
        [10, 0.6, 0.55],
        [7, 0.8, 0.52],
        [9, 0.4, 0.25],
        [11, 0.6, 0.25],
      ],
      '3-5-2': [
        [1, 0.5, 0.92],
        [3, 0.3, 0.78],
        [4, 0.5, 0.8],
        [5, 0.7, 0.78],
        [2, 0.12, 0.55],
        [6, 0.35, 0.55],
        [8, 0.5, 0.58],
        [10, 0.65, 0.55],
        [7, 0.88, 0.55],
        [9, 0.4, 0.25],
        [11, 0.6, 0.25],
      ],
    };
    const scheme = F[name];
    if (!scheme) return;
    this.objects = this.objects.filter((o) => o.type !== 'player');
    scheme.forEach(([num, x, y]) => {
      this.objects.push({
        id: uid(),
        type: 'player',
        x,
        y,
        number: num,
        name: '',
        team: 'own',
        rotation: 0,
        scale: 1,
        visible: true,
        locked: false,
        keyframes: [],
      });
    });
    this.pushHistory();
    this.needsRender = true;
    this.onChange();
  }

  /* ── Animation ── */
  addKeyframe(objectId, time) {
    const o = this.objects.find((x) => x.id === objectId);
    if (!o) return;
    if (!o.keyframes) o.keyframes = [];
    o.keyframes.push({ time, x: o.x, y: o.y, rotation: o.rotation || 0 });
    o.keyframes.sort((a, b) => a.time - b.time);
    this.pushHistory();
  }

  play() {
    this.anim.playing = true;
    this.anim.t = 0;
  }
  pause() {
    this.anim.playing = false;
  }
  stop() {
    this.anim.playing = false;
    this.anim.t = 0;
    this._applyAnimFrame(0);
    this.needsRender = true;
  }

  _applyAnimFrame(t) {
    this.objects.forEach((o) => {
      if (!o.keyframes || o.keyframes.length < 2) return;
      const kfs = o.keyframes;
      let a = kfs[0],
        b = kfs[kfs.length - 1];
      for (let i = 0; i < kfs.length - 1; i++) {
        if (t >= kfs[i].time && t <= kfs[i + 1].time) {
          a = kfs[i];
          b = kfs[i + 1];
          break;
        }
      }
      const span = b.time - a.time || 1;
      const lt = clamp((t - a.time) / span, 0, 1);
      const e = lt * lt * (3 - 2 * lt); // smoothstep
      o.x = a.x + (b.x - a.x) * e;
      o.y = a.y + (b.y - a.y) * e;
      o.rotation = (a.rotation || 0) + ((b.rotation || 0) - (a.rotation || 0)) * e;
    });
  }

  /* ── Render loop ── */
  _loop() {
    if (this.anim.playing) {
      this.anim.t += (1 / 60) * this.anim.speed;
      if (this.anim.t > this.anim.duration) this.anim.t = 0;
      this._applyAnimFrame(this.anim.t);
      this.needsRender = true;
    }
    if (this.needsRender) {
      this._draw();
      this.needsRender = false;
    }
    this.raf = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a1f12';
    ctx.fillRect(0, 0, W, H);

    // Pitch in world space via camera
    const z = this.camera.zoom;
    const ox = (0.5 - this.camera.x) * z;
    const oy = (0.5 - this.camera.y) * z;

    ctx.save();
    ctx.translate(W * ox, H * oy);
    ctx.scale(z, z);
    // draw pitch in pixel space of view at zoom=1
    this._drawPitch(ctx, W, H);
    this._drawObjects(ctx, W, H);
    // live drawing preview
    if (this.drawing) this._drawPreview(ctx, W, H);
    if (this.polygonPts.length) this._drawPolyPreview(ctx, W, H);
    ctx.restore();
  }

  _w2p(wx, wy, W, H) {
    return { x: wx * W, y: wy * H };
  }

  _drawPitch(ctx, W, H) {
    // grass stripes
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1a5c2e' : '#1e6b35';
      ctx.fillRect(0, (i / 12) * H, W, H / 12);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    const m = 0.03;
    ctx.strokeRect(m * W, m * H, (1 - 2 * m) * W, (1 - 2 * m) * H);
    // halfway
    ctx.beginPath();
    ctx.moveTo(m * W, 0.5 * H);
    ctx.lineTo((1 - m) * W, 0.5 * H);
    ctx.stroke();
    // center circle
    ctx.beginPath();
    ctx.arc(0.5 * W, 0.5 * H, 0.09 * Math.min(W, H), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.5 * W, 0.5 * H, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    // penalty boxes
    const pbW = 0.4,
      pbH = 0.16;
    ctx.strokeRect((0.5 - pbW / 2) * W, m * H, pbW * W, pbH * H);
    ctx.strokeRect((0.5 - pbW / 2) * W, (1 - m - pbH) * H, pbW * W, pbH * H);
    const gbW = 0.18,
      gbH = 0.055;
    ctx.strokeRect((0.5 - gbW / 2) * W, m * H, gbW * W, gbH * H);
    ctx.strokeRect((0.5 - gbW / 2) * W, (1 - m - gbH) * H, gbW * W, gbH * H);
  }

  _drawObjects(ctx, W, H) {
    // zones first
    this.objects
      .filter((o) => o.type === 'zone' && o.visible !== false)
      .forEach((o) => {
        ctx.fillStyle = o.fill || 'rgba(200,168,75,0.3)';
        ctx.strokeStyle = '#c8a84b';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        if (o.shape === 'rect') {
          ctx.fillRect(o.x * W, o.y * H, o.w * W, o.h * H);
          ctx.strokeRect(o.x * W, o.y * H, o.w * W, o.h * H);
        } else if (o.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(o.x * W, o.y * H, o.r * Math.min(W, H), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (o.shape === 'polygon' && o.points) {
          ctx.beginPath();
          o.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x * W, p.y * H);
            else ctx.lineTo(p.x * W, p.y * H);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.setLineDash([]);
        if (o.label) {
          ctx.fillStyle = '#fff';
          ctx.font = `600 ${14 * this.dpr}px system-ui`;
          ctx.textAlign = 'center';
          const cx = o.shape === 'rect' ? (o.x + o.w / 2) * W : o.x * W;
          const cy = o.shape === 'rect' ? o.y * H + 16 : o.y * H;
          ctx.fillText(o.label, cx, cy);
        }
      });

    // arrows
    this.objects
      .filter((o) =>
        ['pass', 'run', 'dribble', 'shot', 'press', 'arrow', 'line'].includes(o.type)
      )
      .forEach((o) => {
        const colors = {
          pass: '#3498db',
          run: '#2ecc71',
          dribble: '#9b59b6',
          shot: '#ffffff',
          press: '#e74c3c',
          arrow: '#f1c40f',
          line: '#aaa',
        };
        const col = colors[o.type] || '#f1c40f';
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = o.type === 'shot' ? 4 : 3;
        if (o.type === 'run' || o.type === 'dribble') ctx.setLineDash([10, 6]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(o.x * W, o.y * H);
        ctx.lineTo(o.x2 * W, o.y2 * H);
        ctx.stroke();
        ctx.setLineDash([]);
        // arrowhead
        const ang = Math.atan2(o.y2 - o.y, o.x2 - o.x);
        const ah = 12;
        ctx.beginPath();
        ctx.moveTo(o.x2 * W, o.y2 * H);
        ctx.lineTo(
          o.x2 * W - ah * Math.cos(ang - 0.4),
          o.y2 * H - ah * Math.sin(ang - 0.4)
        );
        ctx.lineTo(
          o.x2 * W - ah * Math.cos(ang + 0.4),
          o.y2 * H - ah * Math.sin(ang + 0.4)
        );
        ctx.closePath();
        ctx.fill();
      });

    // text
    this.objects
      .filter((o) => o.type === 'text')
      .forEach((o) => {
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${16 * this.dpr}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(o.label || '', o.x * W, o.y * H);
      });

    // players / ball / equipment
    this.objects
      .filter((o) =>
        ['player', 'opponent', 'ball', 'cone', 'mannequin'].includes(o.type)
      )
      .forEach((o) => {
        const px = o.x * W;
        const py = o.y * H;
        if (o.type === 'ball') {
          ctx.beginPath();
          ctx.arc(px, py, 8 * this.dpr, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 2;
          ctx.stroke();
          return;
        }
        if (o.type === 'cone') {
          ctx.fillStyle = '#e67e22';
          ctx.beginPath();
          ctx.moveTo(px, py - 12 * this.dpr);
          ctx.lineTo(px - 10 * this.dpr, py + 10 * this.dpr);
          ctx.lineTo(px + 10 * this.dpr, py + 10 * this.dpr);
          ctx.closePath();
          ctx.fill();
          return;
        }
        if (o.type === 'mannequin') {
          ctx.fillStyle = '#95a5a6';
          ctx.fillRect(px - 8 * this.dpr, py - 14 * this.dpr, 16 * this.dpr, 28 * this.dpr);
          return;
        }
        const r = 18 * this.dpr;
        const isGk = o.number === 1;
        const isSel = o.id === this.selectedId;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        if (o.team === 'opp') ctx.fillStyle = '#e74c3c';
        else if (isGk) ctx.fillStyle = '#f1c40f';
        else ctx.fillStyle = '#3498db';
        ctx.fill();
        ctx.strokeStyle = isSel ? '#e8c547' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = isSel ? 3 * this.dpr : 2 * this.dpr;
        ctx.stroke();
        ctx.fillStyle = isGk ? '#1a1a1a' : '#fff';
        ctx.font = `700 ${13 * this.dpr}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(o.number || ''), px, py);
        if (o.name) {
          ctx.fillStyle = '#fff';
          ctx.font = `600 ${10 * this.dpr}px system-ui`;
          ctx.fillText(o.name, px, py + r + 12 * this.dpr);
        }
        // orientation mark
        if (o.rotation) {
          const ox = px + Math.cos(o.rotation) * (r + 4);
          const oy = py + Math.sin(o.rotation) * (r + 4);
          ctx.beginPath();
          ctx.arc(ox, oy, 3 * this.dpr, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
      });
  }

  _drawPreview(ctx, W, H) {
    const d = this.drawing;
    if (!d || !d.current) return;
    ctx.strokeStyle = '#e8c547';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(d.start.x * W, d.start.y * H);
    ctx.lineTo(d.current.x * W, d.current.y * H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawPolyPreview(ctx, W, H) {
    if (!this.polygonPts.length) return;
    ctx.strokeStyle = '#c8a84b';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    this.polygonPts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x * W, p.y * H);
      else ctx.lineTo(p.x * W, p.y * H);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    this.polygonPts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#c8a84b';
      ctx.fill();
    });
  }

  /* ── Public API ── */
  setTool(t) {
    this.tool = t;
    if (t !== 'polygon') this.polygonPts = [];
  }

  setObjects(objs) {
    this.objects = objs || [];
    this.needsRender = true;
  }

  getState() {
    return {
      objects: JSON.parse(JSON.stringify(this.objects)),
      camera: { ...this.camera },
    };
  }

  loadState(state) {
    if (!state) return;
    this.objects = state.objects || [];
    if (state.camera) this.camera = { ...state.camera };
    this.pushHistory();
    this.needsRender = true;
  }

  clear() {
    this.objects = [];
    this.selectedId = null;
    this.polygonPts = [];
    this.pushHistory();
    this.needsRender = true;
    this.onChange();
  }

  deleteSelected() {
    if (!this.selectedId) return;
    this.objects = this.objects.filter((o) => o.id !== this.selectedId);
    this.selectedId = null;
    this.pushHistory();
    this.needsRender = true;
    this.onChange();
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

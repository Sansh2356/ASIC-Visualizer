import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BOARDS, GROUPS, ASICS, PKG, partCount } from '../data/index.js';
import { useStore } from '../store/index.js';

// Seeded PRNG (mulberry32) for stable texture detail across loads
function rng(seed){ return ()=>{ seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export class Scene {
  constructor(canvas, labelsEl, tipEl) {
    this.canvas = canvas;
    this.labelsEl = labelsEl;
    this.tipEl = tipEl;
    this.stage = canvas.parentElement;

    // Three.js objects
    this.renderer = null; this.scene = null; this.camera = null;
    this.controls = null; this.raycaster = null; this.pointer = null;
    this.boardMesh = null; this.boardGroup = null;
    this.coolGroup = null; this.oledGroup = null; this.tpGroup = [];
    this.flowGroup = null; this.coolers = [];

    // Board state
    this.B = null;
    this.objs = {};
    this.flowObjs = {};
    this.MIRROR = true; this.SURF_T = 0.8; this.SURF_B = -0.8;
    this.MATS = {};

    // Interaction state
    this.state = { explode: 0, explodeTarget: 0, highlight: null, selected: null, colorBy: false };
    this.tween = null;
    this.downAt = null; this.downLabel = null;
    this.stageW = 1; this.stageH = 1;
    this.labelAnchorsAt = NaN; this.labelGold = '';
    this.LABELED = [];
    this._v = new THREE.Vector3(); this._box = new THREE.Box3();

    this._unsubscribes = [];
    this._animId = null;
    this._last = performance.now();
    this._groupColors = {};
  }

  // ── boot ────────────────────────────────────────────────────────────────
  init() {
    const { canvas, stage } = this;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c100f);

    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
    this.camera.position.set(95, 120, 120);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 25; this.controls.maxDistance = 420;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('start', () => { this.tween = null; });

    this.scene.add(new THREE.HemisphereLight(0xdfe9e4, 0x1a1f1d, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.78);
    key.position.set(60, 140, 70); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 400 });
    this.scene.add(key);
    const under = new THREE.DirectionalLight(0xbfd6ff, 0.55); under.position.set(-50, -140, -40); this.scene.add(under);
    const rim = new THREE.DirectionalLight(0xffe2b0, 0.35); rim.position.set(-120, 40, -80); this.scene.add(rim);
    const grid = new THREE.GridHelper(400, 40, 0x1c2622, 0x141b18); grid.position.y = -38; this.scene.add(grid);

    this._baseMaterials();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    let moveEvt = null;
    canvas.addEventListener('pointermove', e => { if (!moveEvt) requestAnimationFrame(() => { this._onMove(moveEvt); moveEvt = null; }); moveEvt = e; });
    canvas.addEventListener('pointerdown', e => { this.downAt = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => this._onClick(e));
    canvas.addEventListener('pointerleave', () => { this.tipEl.hidden = true; });

    new ResizeObserver(() => this._resize()).observe(stage);
    this._resize();
    this._animate();

    this._subscribeToStore();
  }

  loadBoard(boardId) {
    const board = BOARDS[boardId] || Object.values(BOARDS)[0];
    this.B = board;
    this.state.explodeTarget = 0; this.state.explode = 0;
    this.state.selected = null; this.state.highlight = null;
    this.MIRROR = board.topLayer === 'B';
    this.SURF_T = board.BT / 2; this.SURF_B = -board.BT / 2;
    this.controls.maxDistance = 420 * Math.max(1, this._sizeK());
    this._buildScene();
    this._buildLabels();
    this._applyPassives(useStore.getState().showPassives);
    this._applyTP(useStore.getState().showTP);
    this._applyXray(useStore.getState().xray);
    this.oledGroup.visible = !!board.oled && useStore.getState().showOled;
    this._renderFlowLegend();
    // Publish the obj registry so React components can render the component list
    useStore.setState({ _objs: this.objs });
  }

  select(ref, opts = {}) {
    this.state.selected = ref;
    if (ref) {
      this._ensureVisibleFor(ref);
      if (opts.fly) {
        const o = this.objs[ref];
        this._frameRefs([ref], o.side === 'bottom' ? 'bottom' : 'top');
      }
    }
    if (useStore.getState().mode === 'free') {
      this.state.highlight = null;
    }
    this._applyHighlight();
  }

  setView(name, instant) {
    const [p, t] = this._viewPreset(name);
    if (instant) { this.camera.position.copy(p); this.controls.target.copy(t); }
    else this._flyTo(p, t);
  }

  applyFlows(ids) {
    Object.entries(this.flowObjs).forEach(([id, f]) => { f.group.visible = ids.includes(id); });
    this._renderFlowLegend();
  }

  applyHighlightForTour(refs, selected) {
    this.state.highlight = refs.length ? refs.slice() : null;
    this.state.selected = selected || null;
    this._applyHighlight();
  }

  setExplodeTarget(v) { this.state.explodeTarget = v; }
  setCoolVisible(v) { if (this.coolGroup) this.coolGroup.visible = v; }
  setOledVisible(v) { if (this.oledGroup) this.oledGroup.visible = v; }
  setPassivesVisible(v) { this._applyPassives(v); }
  setTPVisible(v) { this._applyTP(v); }
  setXray(v) { this._applyXray(v); }
  setColorBy(v) { this.state.colorBy = v; this._applyHighlight(); }

  frameRefs(refs, side) { this._frameRefs(refs, side); }
  frameCooler() { this._frameCooler(); }

  getFlowObjs() { return this.flowObjs; }
  getBoard() { return this.B; }
  getObjs() { return this.objs; }
  partCountForBoard() { return this.B ? partCount(this.B) : 0; }

  // Briefly flash the ASIC chip mesh with a tint color (hex number, e.g. 0x00ff88).
  // durationMs defaults to 200ms. Called by the SHA-256 hash engine on each round tick.
  pulseAsic(color = 0x00ff88, durationMs = 180) {
    const asicObj = Object.values(this.objs).find(o => o.data?.mat === 'asic');
    if (!asicObj?.mesh) return;
    const mesh = asicObj.mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const origColors = mats.map(m => m.emissive?.getHex?.() ?? 0);
    const origIntensities = mats.map(m => m.emissiveIntensity ?? 0);
    const col = new THREE.Color(color);
    mats.forEach(m => { if (m.emissive) { m.emissive.set(col); m.emissiveIntensity = 0.6; } });
    setTimeout(() => {
      mats.forEach((m, i) => {
        if (m.emissive) { m.emissive.setHex(origColors[i]); m.emissiveIntensity = origIntensities[i]; }
      });
    }, durationMs);
  }

  destroy() {
    this._unsubscribes.forEach(u => u());
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }
  }

  // ── scene building ───────────────────────────────────────────────────────
  _buildScene() {
    if (this.boardGroup) {
      this.scene.remove(this.boardGroup);
      this.boardGroup.traverse(m => {
        if (!m.isMesh) return;
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach(mt => { if (mt.map) mt.map.dispose(); mt.dispose(); });
      });
    }
    this.objs = {}; this.flowObjs = {};
    this.labelsEl.innerHTML = ''; this.labelAnchorsAt = NaN;
    this.boardGroup = new THREE.Group(); this.scene.add(this.boardGroup);
    this._buildBoard(); this._buildParts(); this._buildPassives();
    this._buildTestPoints(); this._buildCooling(); this._buildOled(); this._buildFlows();
  }

  _baseMaterials() {
    const M = this.MATS;
    M.ic = new THREE.MeshStandardMaterial({color:0x1d1f21, roughness:.55, metalness:.1});
    M.asic = new THREE.MeshStandardMaterial({color:0x2a2c30, roughness:.35, metalness:.35});
    M.metal = new THREE.MeshStandardMaterial({color:0xc9ccd0, roughness:.3, metalness:.9});
    M.inductor = new THREE.MeshStandardMaterial({color:0x2b2b2d, roughness:.7, metalness:.2});
    M.jack = new THREE.MeshStandardMaterial({color:0x141414, roughness:.6});
    M.header = new THREE.MeshStandardMaterial({color:0x181818, roughness:.6});
    M.pads = new THREE.MeshStandardMaterial({color:0xd8b35a, roughness:.3, metalness:.9});
    M.button = new THREE.MeshStandardMaterial({color:0x2a2a2a, roughness:.5});
    M.fanconn = new THREE.MeshStandardMaterial({color:0xe9e4d8, roughness:.6});
    M.cap = new THREE.MeshStandardMaterial({color:0xa48a5e, roughness:.55});
    M.res = new THREE.MeshStandardMaterial({color:0x1c1c1c, roughness:.6});
    M.term = new THREE.MeshStandardMaterial({color:0xcfd2d4, roughness:.3, metalness:.85});
    M.esp = new THREE.MeshStandardMaterial({color:0xc0c4c8, roughness:.28, metalness:.9});
    M.ecap = new THREE.MeshStandardMaterial({color:0x2a2f3a, roughness:.35, metalness:.6});
  }

  _toWorld(x, y) { const X = x - this.B.EDGE.x0 - this.B.BW / 2; return [this.MIRROR ? -X : X, (y - this.B.EDGE.y0 - this.B.BH / 2)]; }
  _sizeK() { return Math.max(this.B.BW, this.B.BH) / 97.2; }

  _makeLabelTexture(text, w, h, opts = {}) {
    const c = document.createElement('canvas');
    const s = 16; c.width = Math.max(64, Math.round(w * s)); c.height = Math.max(32, Math.round(h * s));
    const g = c.getContext('2d');
    g.fillStyle = opts.bg || '#1b1d1f'; g.fillRect(0, 0, c.width, c.height);
    if (opts.grain) { const r = rng(c.width * 31 + c.height); for (let i = 0; i < c.width * c.height / 30; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(r() * c.width, r() * c.height, 1, 1); } }
    if (opts.draw) opts.draw(g, c);
    if (text) {
      g.fillStyle = opts.fg || '#cfd4d2';
      let fs = Math.min(c.height * 0.32, c.width / (text.length * 0.62));
      g.font = `500 ${fs}px "IBM Plex Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = text.split('\n');
      lines.forEach((ln, i) => g.fillText(ln, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * fs * 1.25));
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  _roundedRectShape(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }

  _boardTexture(side) {
    const { EDGE, BW, BH, HOLES, ART } = this.B;
    const s = 12, c = document.createElement('canvas'); c.width = Math.round(BW * s); c.height = Math.round(BH * s);
    const g = c.getContext('2d');
    g.fillStyle = ART.mask || '#123d2a'; g.fillRect(0, 0, c.width, c.height);
    const rand = rng(601);
    g.globalAlpha = .18; g.fillStyle = ART.pour || '#1f6a45';
    for (let i = 0; i < 14 * BW * BH / 5568; i++) { g.fillRect(rand() * c.width, rand() * c.height, 30 + rand() * 180, 20 + rand() * 120); }
    g.globalAlpha = 1;
    const flip = (side === 'top') === this.MIRROR;
    const P = (x, y) => [flip ? (EDGE.x1 - x) * s : (x - EDGE.x0) * s, (y - EDGE.y0) * s];
    g.strokeStyle = 'rgba(70,160,110,.55)'; g.lineWidth = 2.2; g.lineCap = 'round';
    (ART.traces[side] || []).forEach(pts => { g.beginPath(); pts.forEach((p, i) => { const [a, b] = P(p[0], p[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); });
    if (side === 'top') {
      if (ART.keepout) {
        const [cx, cy, sz] = ART.keepout, h = sz / 2;
        g.strokeStyle = 'rgba(235,240,236,.85)'; g.lineWidth = 2;
        const [hx0, hy0] = P(cx + h, cy - h), [hx1, hy1] = P(cx - h, cy + h);
        g.strokeRect(Math.min(hx0, hx1), Math.min(hy0, hy1), Math.abs(hx1 - hx0), Math.abs(hy1 - hy0));
      }
      const L = ART.logo;
      g.fillStyle = '#e6c25a'; g.font = `700 ${9 * s}px "Chakra Petch", serif`; g.textAlign = 'center';
      const [lx, ly] = P(L.x, L.y); g.fillText(L.text, lx, ly);
      g.font = `600 ${3.2 * s}px "IBM Plex Mono", monospace`; g.fillStyle = '#eef2ef'; g.fillText(L.sub, lx, ly + 4.6 * s);
    }
    g.fillStyle = '#eef2ef'; g.font = `500 ${2.2 * s}px "IBM Plex Mono", monospace`; g.textAlign = 'center';
    (ART.silk[side] || []).forEach(([t, x, y]) => { const [a, b] = P(x, y); g.fillText(t, a, b); });
    g.fillStyle = 'rgba(216,179,90,.8)';
    const vr = rng(1370);
    for (let i = 0; i < 220 * BW * BH / 5568; i++) {
      const x = EDGE.x0 + 3 + vr() * (BW - 6), y = EDGE.y0 + 3 + vr() * (BH - 6);
      if (this.B.HOLES.some(([, hx, hy, d]) => Math.hypot(x - hx, y - hy) < d / 2 + 2.2)) continue;
      const [a, b] = P(x, y); g.beginPath(); g.arc(a, b, 3, 0, Math.PI * 2); g.fill();
    }
    this.B.PARTS.filter(p => p.mat === 'asic').forEach(p => {
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const [a, b] = P(p.x + i * 1.4, p.y + j * 1.4); g.beginPath(); g.arc(a, b, 5, 0, Math.PI * 2); g.fill(); }
    });
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  _buildBoard() {
    const { BW, BH, BT, HOLES } = this.B;
    const R = this.B.EDGE.r ?? 1.2, shape = this._roundedRectShape(BW, BH, R);
    HOLES.forEach(([, x, y, d]) => { const [X, Z] = this._toWorld(x, y); const h = new THREE.Path(); h.absarc(X, -Z, d / 2, 0, Math.PI * 2, true); shape.holes.push(h); });
    const geo = new THREE.ExtrudeGeometry(shape, { depth: BT, bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -BT / 2, 0);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x2c4f3a, roughness: .8 });
    this.boardMesh = new THREE.Mesh(geo, edgeMat); this.boardMesh.receiveShadow = true; this.boardGroup.add(this.boardMesh);
    const faceShape = (side) => {
      const sh = this._roundedRectShape(BW, BH, R);
      HOLES.forEach(([, x, y, d]) => { const [X, Z] = this._toWorld(x, y); const h = new THREE.Path(); h.absarc(X, side === 'top' ? -Z : Z, d / 2, 0, Math.PI * 2, true); sh.holes.push(h); }); return sh;
    };
    const mk = (side) => {
      const top = side === 'top';
      const m = new THREE.MeshStandardMaterial({ map: this._boardTexture(side), roughness: .45, metalness: .05 });
      const f = new THREE.Mesh(new THREE.ShapeGeometry(faceShape(side), 24), m);
      f.rotation.x = top ? -Math.PI / 2 : Math.PI / 2;
      f.position.y = top ? this.SURF_T + 0.01 : this.SURF_B - 0.01;
      const uv = f.geometry.attributes.uv, pos = f.geometry.attributes.position;
      for (let i = 0; i < uv.count; i++) { const u = (pos.getX(i) + BW / 2) / BW, v = (pos.getY(i) + BH / 2) / BH; uv.setXY(i, top ? u : 1 - u, top ? v : 1 - v); }
      f.receiveShadow = true; this.boardGroup.add(f); return f;
    };
    this.boardGroup.userData.faces = [mk('top'), mk('bottom')];
    HOLES.forEach(([ref, x, y, d, kind]) => {
      const [X, Z] = this._toWorld(x, y);
      if (kind === 'pad') {
        [this.SURF_T + 0.02, this.SURF_B - 0.02].forEach(yy => { const r = new THREE.Mesh(new THREE.RingGeometry(d / 2, d / 2 + 1.6, 32), this.MATS.pads); r.rotation.x = -Math.PI / 2; r.position.set(X, yy, Z); this.boardGroup.add(r); });
      }
      const id = this._registerSimple(ref, this.B.HOLE_TEXT[kind][0], 'mech', 'top', x, y, this.B.HOLE_TEXT[kind][1]);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(d / 2 + 0.05, d / 2 + 0.05, BT + 0.1, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xb8a060, metalness: .8, roughness: .35, side: THREE.DoubleSide }));
      ring.position.set(X, 0, Z); id.group.add(ring); id.meshes.push(ring); ring.userData.ref = ref;
    });
  }

  _addObj(ref, data, side) {
    const g = new THREE.Group(); this.boardGroup.add(g);
    this.objs[ref] = { group: g, meshes: [], data, side, labelEl: null };
    return this.objs[ref];
  }

  _registerSimple(ref, name, group, side, x, y, desc) {
    const data = { ref, name, group, side, x, y, what: desc, simple: true };
    return this._addObj(ref, data, side);
  }

  _rotDims(d, rot) { const r = ((rot % 360) + 360) % 360; return (r === 90 || r === 270) ? [d[1], d[0], d[2]] : [d[0], d[1], d[2]]; }

  _faceOf(p) {
    const f = p.face || '-x', isX = f[1] === 'x', s = f[0] === '+' ? 1 : -1;
    return { axis: isX ? 'x' : 'z', sign: isX && this.MIRROR ? -s : s };
  }

  _partMesh(p) {
    const [w, l, h] = this._rotDims(p.dims, p.rot);
    const F = this._faceOf(p), len = F.axis === 'x' ? w : l, wid = F.axis === 'x' ? l : w;
    const xz = (a, c) => F.axis === 'x' ? [a, c] : [c, a];
    const grp = new THREE.Group();
    const M = this.MATS;
    const add = (geo, mat, y, x = 0, z = 0) => { const m = new THREE.Mesh(geo, mat.clone()); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
    const topMatWithLabel = (base, text, opts) => {
      const mats = []; for (let i = 0; i < 6; i++) mats.push(base.clone());
      mats[2] = new THREE.MeshStandardMaterial({ map: this._makeLabelTexture(text, w, l, opts), roughness: base.roughness, metalness: base.metalness });
      return mats;
    };
    switch (p.mat) {
      case 'esp': {
        add(new THREE.BoxGeometry(w, 0.8, l), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .6 }), 0.4);
        const [sw, sl] = xz(len - 6.2, wid - 1.2), [sx, sz] = xz(-F.sign * 3.1, 0);
        const can = new THREE.Mesh(new THREE.BoxGeometry(sw, 2.3, sl), topMatWithLabel(M.esp, "ESPRESSIF\nESP32-S3-WROOM-1\nN16R8", { bg: '#c4c8cc', fg: '#3b3f44', grain: true }));
        can.position.set(sx, 0.8 + 1.15, sz); can.castShadow = true; grp.add(can);
        const ant = new THREE.Mesh(new THREE.PlaneGeometry(5.6, wid - 1), new THREE.MeshStandardMaterial({ map: this._makeLabelTexture('', 5.6, wid - 1, { bg: '#151515', draw: (g, c) => { g.strokeStyle = '#c9a24e'; g.lineWidth = 6; g.beginPath(); let x = c.width * .25; g.moveTo(x, c.height * .1); for (let i = 0; i < 7; i++) { g.lineTo(x, c.height * (.15 + i * .1)); x = x === c.width * .25 ? c.width * .75 : c.width * .25; g.lineTo(x, c.height * (.15 + i * .1)); } g.stroke(); } }), roughness: .6 }));
        const [ax, az] = xz(F.sign * (len / 2 - 3), 0);
        ant.rotation.set(-Math.PI / 2, 0, F.axis === 'x' ? 0 : Math.PI / 2); ant.position.set(ax, 0.81, az); grp.add(ant);
        const [pw, pl] = xz(0.9, 0.5);
        for (let i = 0; i < 14; i++) { const a = F.sign * (len / 2 - 6.5 - i * 1.27); [1, -1].forEach(s => { const [px, pz] = xz(a, s * wid / 2); add(new THREE.BoxGeometry(pw, 0.85, pl), M.pads, 0.42, px, pz); }); }
        break;
      }
      case 'asic': {
        add(new THREE.BoxGeometry(w, 0.25, l), new THREE.MeshStandardMaterial({ color: 0x3a3326, roughness: .6 }), 0.12);
        const die = new THREE.Mesh(new THREE.BoxGeometry(w - 1.6, 0.75, l - 1.6), topMatWithLabel(M.asic, p.mark, { bg: '#3a3d44', fg: '#c8ccd4', grain: true }));
        die.position.y = 0.25 + 0.37; die.castShadow = true; grp.add(die);
        const chip = ASICS[p.mark], per = chip ? chip.pins.length / 2 : 15, pitch = per > 15 ? 0.48 : 0.502;
        const along = w >= l ? 'z' : 'x', half = (along === 'z' ? w : l) / 2 + 0.15;
        for (let i = 0; i < per; i++) { const o = -(per - 1) * pitch / 2 + i * pitch; [1, -1].forEach(s => { const pad = along === 'z' ? [0.7, 0.22, s * half, o] : [0.22, 0.7, o, s * half]; add(new THREE.BoxGeometry(pad[0], 0.12, pad[1]), M.pads, 0.06, pad[2], pad[3]); }); }
        break;
      }
      case 'tdisplay': {
        const stand = h - 2.6, rows = wid / 2 - 1.3;
        [1, -1].forEach(s => { const [rw, rl] = xz(len * 0.4, 2.5), [rx, rz] = xz(-F.sign * len * 0.08, s * rows); add(new THREE.BoxGeometry(rw, stand, rl), M.header, stand / 2, rx, rz); });
        add(new THREE.BoxGeometry(...(F.axis === 'x' ? [len, 1.2, wid] : [wid, 1.2, len])), new THREE.MeshStandardMaterial({ color: 0x111214, roughness: .6 }), stand + 0.6);
        const [gw, gl] = xz(len * 0.72, wid - 3), [gx, gz] = xz(-F.sign * len * 0.1, 0);
        const screen = new THREE.Mesh(new THREE.BoxGeometry(gw, 1.2, gl), [0, 0, 0, 0, 0, 0].map((_, i) => i === 2 ? new THREE.MeshStandardMaterial({ map: this._makeLabelTexture('', gw, gl, { bg: '#05070a', draw: (g, c) => { g.save(); if (F.axis === 'z') { g.translate(c.width, 0); g.rotate(Math.PI / 2); } const W = F.axis === 'z' ? c.height : c.width, H = F.axis === 'z' ? c.width : c.height; g.fillStyle = '#ff9f3a'; g.font = `700 ${H * .2}px "Chakra Petch",sans-serif`; g.fillText(p.screen[0], W * .06, H * .3); g.fillStyle = '#e3ebe6'; g.font = `500 ${H * .12}px "IBM Plex Mono",monospace`; p.screen.slice(1).forEach((t, k) => g.fillText(t, W * .06, H * (.52 + k * .17))); g.restore(); } }), emissive: 0x111111, roughness: .2 }) : new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: .3 })));
        screen.position.set(gx, stand + 1.8, gz); screen.castShadow = true; grp.add(screen);
        const [uw, ul] = xz(7.4, 9), [ux, uz] = xz(F.sign * (len / 2 - 2.6), 0);
        add(new THREE.BoxGeometry(uw, 3.2, ul), M.metal, stand + 1.2 + 1.6, ux, uz);
        break;
      }
      case 'inductor':
        add(new THREE.BoxGeometry(w, h, l), M.inductor, h / 2);
        add(new THREE.BoxGeometry(w - 0.6, 0.05, l - 0.6), new THREE.MeshStandardMaterial({ map: this._makeLabelTexture(p.mark || '', w, l, { bg: '#2e2e30', fg: '#9b9ba0' }) }), h + 0.02);
        add(new THREE.BoxGeometry(1.6, 1.2, l * 0.8), M.term, 0.6, -w / 2 + 0.8); add(new THREE.BoxGeometry(1.6, 1.2, l * 0.8), M.term, 0.6, w / 2 - 0.8);
        break;
      case 'jack': {
        add(new THREE.BoxGeometry(w, h, l), p.color ? new THREE.MeshStandardMaterial({ color: p.color, roughness: .55 }) : M.jack, h / 2);
        const axial = g => F.axis === 'x' ? g.rotateZ(Math.PI / 2) : g.rotateX(Math.PI / 2);
        const bore = new THREE.Mesh(axial(new THREE.CylinderGeometry(2.9, 2.9, 1, 24)), new THREE.MeshStandardMaterial({ color: 0x050505 }));
        const [bx, bz] = xz(F.sign * (len / 2 + 0.01), 0); bore.position.set(bx, h / 2 + 0.5, bz); grp.add(bore);
        const [cx2, cz2] = xz(F.sign * (len / 2 - 0.2), 0);
        add(axial(new THREE.CylinderGeometry(1.05, 1.05, 1.2, 16)), M.term, h / 2 + 0.5, cx2, cz2);
        break;
      }
      case 'header': {
        add(new THREE.BoxGeometry(w, 2.5, l), M.header, 1.25);
        const pitch = p.pitch || 2.54, n = Math.round(Math.max(w, l) / pitch);
        for (let i = 0; i < n; i++) { const off = -((n - 1) * pitch) / 2 + i * pitch; const pin = new THREE.BoxGeometry(0.64, h, 0.64); if (w > l) add(pin, M.pads, h / 2, off, 0); else add(pin, M.pads, h / 2, 0, off); }
        break;
      }
      case 'fanconn': {
        add(new THREE.BoxGeometry(w, h, l), M.fanconn, h / 2);
        const n = p.pins || 4, L = Math.max(w, l), pitch2 = p.pitch || (L > 8 ? 2.54 : 1);
        for (let i = 0; i < n; i++) { const off = -((n - 1) * pitch2) / 2 + i * pitch2; add(new THREE.BoxGeometry(0.6, h * 0.8, 0.6), M.pads, h * 0.55, w >= l ? off : 0, w >= l ? 0 : off); }
        break;
      }
      case 'button':
        add(new THREE.BoxGeometry(w, 1, l), M.button, 0.5);
        add(new THREE.CylinderGeometry(0.9, 0.9, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0x111111 }), 1.4);
        break;
      case 'pads':
        if (p.shape === 'tagconnect') { for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) add(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16), M.pads, 0.03, -1.27 + i * 1.27, -0.635 + j * 1.27); }
        else add(new THREE.BoxGeometry(w, 0.06, l), M.pads, 0.03);
        break;
      case 'metal': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), M.metal.clone()); body.position.y = h / 2; body.castShadow = true; grp.add(body);
        if (p.shape === 'usbc') { const [mw, ml] = xz(0.4, 6.2), [mx, mz] = xz(F.sign * (len / 2 + 0.01), 0); const mouth = new THREE.Mesh(new THREE.BoxGeometry(mw, 1.6, ml), new THREE.MeshStandardMaterial({ color: 0x050505 })); mouth.position.set(mx, h / 2, mz); grp.add(mouth); }
        break;
      }
      default: {
        const mats = topMatWithLabel(M.ic, p.mark || p.ref, { bg: '#1d1f22', fg: '#8e9499' });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mats); b.position.y = h / 2; b.castShadow = true; grp.add(b);
        const isLong = Math.max(w, l);
        if (p.leads !== false && !/QFN|SON/.test(p.pkg)) {
          const along = w >= l ? 'x' : 'z', n = Math.max(2, Math.round(isLong / 0.95));
          for (let i = 0; i < Math.min(n, 8); i++) { const off = -isLong / 2 + 0.5 + i * (isLong - 1) / Math.max(1, Math.min(n, 8) - 1); const lead = new THREE.BoxGeometry(along === 'x' ? 0.25 : 0.5, 0.15, along === 'x' ? 0.5 : 0.25); if (along === 'x') { add(lead, M.term, 0.08, off, l / 2 + 0.2); add(lead, M.term, 0.08, off, -l / 2 - 0.2); } else { add(lead, M.term, 0.08, w / 2 + 0.2, off); add(lead, M.term, 0.08, -w / 2 - 0.2, off); } }
        }
      }
    }
    return grp;
  }

  _placeGroup(o, x, y, side, inner) {
    const [X, Z] = this._toWorld(x, y);
    o.group.position.set(X, side === 'top' ? this.SURF_T : this.SURF_B, Z);
    if (side === 'bottom') inner.rotation.x = Math.PI;
    o.group.add(inner); o.baseY = o.group.position.y;
    inner.traverse(m => { if (m.isMesh) { o.meshes.push(m); m.userData.ref = o.data.ref; } });
  }

  _buildParts() { this.B.PARTS.forEach(p => { const o = this._addObj(p.ref, p, p.side); this._placeGroup(o, p.x, p.y, p.side, this._partMesh(p)); }); }

  _buildPassives() {
    this.B.PASSIVES.forEach(([ref, val, size, x, y, rot, nets, group, role, side]) => {
      const isR = ref[0] === 'R', can = size.startsWith('CP'), dnp = val === 'DNP';
      const kind = isR ? 'Resistor ' : can ? 'Electrolytic capacitor ' : 'Capacitor ';
      const data = { ref, name: kind + val, part: kind + val + ' · ' + size, pkg: (can ? 'Ø' + size.slice(2).replace('x', ' × ') + ' mm can' : size) + ' SMD', group: 'passive', subgroup: group, side, x, y, rot, what: role, netsStr: nets, passive: true, dnp };
      const o = this._addObj(ref, data, side);
      const d = this._rotDims(PKG[size], rot);
      const grp = new THREE.Group();
      if (can) {
        grp.add(new THREE.Mesh(new THREE.BoxGeometry(d[0], 0.8, d[1]), this.MATS.header.clone())).position.y = 0.4;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(d[0] / 2 - 0.15, d[0] / 2 - 0.15, d[2] - 0.8, 28), this.MATS.ecap.clone()); body.position.y = 0.8 + (d[2] - 0.8) / 2; body.castShadow = true; grp.add(body);
      } else if (!dnp) {
        const body = new THREE.Mesh(new THREE.BoxGeometry(d[0] * (d[0] > d[1] ? 0.7 : 1), d[2], d[1] * (d[1] > d[0] ? 0.7 : 1)), (isR ? this.MATS.res : this.MATS.cap).clone()); body.position.y = d[2] / 2; body.castShadow = true; grp.add(body);
        const along = d[0] >= d[1]; [-1, 1].forEach(s => { const t = new THREE.Mesh(new THREE.BoxGeometry(along ? d[0] * 0.16 : d[0], d[2] * 1.02, along ? d[1] : d[1] * 0.16), this.MATS.term.clone()); t.position.set(along ? s * d[0] * 0.42 : 0, d[2] / 2, along ? 0 : s * d[1] * 0.42); grp.add(t); });
      } else {
        [-1, 1].forEach(s => { const along = d[0] >= d[1]; const t = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.4 : d[0], 0.04, along ? d[1] : 0.4), this.MATS.pads.clone()); t.position.set(along ? s * d[0] * 0.35 : 0, 0.02, along ? 0 : s * d[1] * 0.35); grp.add(t); });
      }
      this._placeGroup(o, x, y, side, grp); o.isPassive = true;
    });
  }

  _buildTestPoints() {
    this.tpGroup = [];
    this.B.TPS.forEach(([ref, x, y, net, side]) => {
      const data = { ref, name: 'Test point · ' + net, part: 'Test pad', pkg: 'TestPoint_Pad', group: 'test', side, x, y, what: `Bare copper pad on the ${net} net. Touch a multimeter or scope probe here to measure the signal or rail while debugging.`, netsStr: net, tp: true };
      const o = this._addObj(ref, data, side);
      const grp = new THREE.Group();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 20), this.MATS.pads.clone()); m.position.y = 0.04; grp.add(m);
      this._placeGroup(o, x, y, side, grp); o.group.visible = false; o.isTP = true; this.tpGroup.push(o);
    });
  }

  _buildCooling() {
    this.coolGroup = new THREE.Group(); this.boardGroup.add(this.coolGroup); this.coolGroup.visible = false;
    this.coolers = this.B.COOLERS.map(c => {
      const grp = new THREE.Group(); this.coolGroup.add(grp);
      const [X, Z] = this._toWorld(c.x, c.y), S = c.size, k = c.fan / 40;
      grp.position.set(X, this.SURF_T, Z);
      const al = new THREE.MeshStandardMaterial({ color: 0xb9bec3, metalness: .85, roughness: .35 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(S, 3, S), al); base.position.y = 1.0 + 1.5; base.castShadow = true; grp.add(base);
      const pitch = (S - 3) / (c.fins - 1);
      for (let i = 0; i < c.fins; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, c.finH, S), al); fin.position.set(-S / 2 + 1.5 + i * pitch, 1 + 3 + c.finH / 2, 0); fin.castShadow = true; grp.add(fin); }
      const fan = new THREE.Group(); fan.position.y = 1 + 3 + c.finH; grp.add(fan);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a8172, roughness: .8 });
      const r = c.fan / 2, frame = new THREE.Shape(); frame.moveTo(-r, -r); frame.lineTo(r, -r); frame.lineTo(r, r); frame.lineTo(-r, r); frame.lineTo(-r, -r);
      const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.93, 0, Math.PI * 2, true); frame.holes.push(hole);
      const fg = new THREE.ExtrudeGeometry(frame, { depth: 10, bevelEnabled: false, curveSegments: 40 }); fg.rotateX(-Math.PI / 2);
      const fm = new THREE.Mesh(fg, frameMat); fm.castShadow = true; fan.add(fm);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(7 * k, 7 * k, 8, 32), new THREE.MeshStandardMaterial({ color: 0x5a3d31, roughness: .7 })); hub.position.y = 5; fan.add(hub);
      const blades = new THREE.Group(); blades.position.y = 5; fan.add(blades);
      const bm = new THREE.MeshStandardMaterial({ color: 0x6a4638, roughness: .65, side: THREE.DoubleSide });
      for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(11 * k, 0.6, 5.5 * k), bm); b.position.set(Math.cos(i / 9 * Math.PI * 2) * 12.5 * k, 0, Math.sin(i / 9 * Math.PI * 2) * 12.5 * k); b.rotation.y = -i / 9 * Math.PI * 2; b.rotation.x = .45; blades.add(b); }
      const o = { group: grp, meshes: [], data: { ref: c.ref, simple: true, ...c.data }, side: 'top', floating: true, baseY: this.SURF_T };
      grp.traverse(m => { if (m.isMesh) { o.meshes.push(m); m.userData.ref = c.ref; } });
      this.objs[c.ref] = o;
      return { spec: c, group: grp, fan, blades, fanY: fan.position.y };
    });
  }

  _isCooler(ref) { return this.B.COOLERS.some(c => c.ref === ref); }
  _underCooler(ref) { return this.B.COOLERS.some(c => c.under.includes(ref)); }

  _buildOled() {
    this.oledGroup = new THREE.Group(); this.boardGroup.add(this.oledGroup);
    if (!this.B.oled) return;
    const [hx, hz] = this._toWorld(this.B.oled.x, this.B.oled.y);
    this.oledGroup.position.set(hx - 15.5, this.SURF_T + 8.5, hz + 5.6);
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(38, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x1d4fa8, roughness: .6 })); pcb.castShadow = true; this.oledGroup.add(pcb);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(30, 1.4, 11.4), [0, 0, 0, 0, 0, 0].map((_, i) => i === 2 ? new THREE.MeshStandardMaterial({ map: this._makeLabelTexture('', 30, 11.4, { bg: '#05070a', draw: (g, c) => { g.fillStyle = '#57b7ff'; g.font = `500 ${c.height * .17}px "IBM Plex Mono",monospace`; ['Gh: 1206.1  J/Th: 14', 'A/R: 22985/59', 'UT: 2d 11h 53m', 'BD: 60.4M'].forEach((t, i) => g.fillText(t, c.width * .06, c.height * (.24 + i * .21))); } }), emissive: 0x0d2a44, roughness: .2 }) : new THREE.MeshStandardMaterial({ color: 0x111418, roughness: .2 })));
    glass.position.set(-2.5, 1.2, 0); this.oledGroup.add(glass);
    const o = { group: this.oledGroup, meshes: [], data: { ref: 'DSP1', short: 'OLED', name: '0.91" OLED module', group: 'io', side: 'top', simple: true, part: 'SSD1306 128 × 32 I2C OLED', what: `The plug-in status display. It sits on the ${this.B.oled.header} header and shows hashrate, efficiency, shares, uptime and best difficulty. The firmware drives it at I2C address 0x3C. The values shown here are sample readings.`, specs: [["Controller", "SSD1306"], ["Resolution", "128 × 32"], ["Bus", "I2C 0x3C (3.3 V)"]] }, side: 'top', floating: true };
    this.oledGroup.traverse(m => { if (m.isMesh) { o.meshes.push(m); m.userData.ref = 'DSP1'; } });
    this.objs['DSP1'] = o; o.baseY = this.oledGroup.position.y;
  }

  _flowCurve(pts) {
    const v = pts.map(([x, y, s]) => { const [X, Z] = this._toWorld(x, y); return new THREE.Vector3(X, s === 't' ? this.SURF_T + 2.2 : this.SURF_B - 2.2, Z); });
    return new THREE.CatmullRomCurve3(v, false, 'centripetal', .5);
  }

  _buildFlows() {
    this.flowGroup = new THREE.Group(); this.boardGroup.add(this.flowGroup);
    this.B.FLOWS.forEach(f => {
      const g = new THREE.Group(); g.visible = false; this.flowGroup.add(g);
      const curves = (f.multi || [f.pts]).map(p => this._flowCurve(p));
      const col = new THREE.Color(f.color);
      const parts = [];
      curves.forEach(c => {
        const tube = new THREE.Mesh(new THREE.TubeGeometry(c, 80, .18, 6, false), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .35, depthWrite: false }));
        g.add(tube);
        for (let i = 0; i < f.n; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.55, 10, 8), new THREE.MeshBasicMaterial({ color: col })); s.userData = { curve: c, t: i / f.n }; g.add(s); parts.push(s); }
      });
      this.flowObjs[f.id] = { group: g, parts, speed: f.speed, data: f };
    });
  }

  // ── interaction ──────────────────────────────────────────────────────────
  _pick(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const cand = []; for (const ref in this.objs) { const o = this.objs[ref]; if (this._isVisible(o.group)) cand.push(...o.meshes); }
    if (!useStore.getState().xray) cand.push(this.boardMesh, ...this.boardGroup.userData.faces);
    const hits = this.raycaster.intersectObjects(cand, false);
    return hits.length ? hits[0].object.userData.ref || null : null;
  }

  _isVisible(m) { let o = m; while (o) { if (!o.visible) return false; o = o.parent; } return true; }

  _onMove(e) {
    if (!e || e.buttons) { this.tipEl.hidden = true; return; }
    const ref = this._pick(e);
    useStore.setState({ hovered: ref });
    if (ref && this.objs[ref]) {
      const d = this.objs[ref].data, r = this.stage.getBoundingClientRect();
      this.tipEl.innerHTML = `<code>${d.ref}</code>${_esc(d.name)}`;
      this.tipEl.hidden = false;
      let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
      if (x > r.width - 270) x -= 290;
      this.tipEl.style.left = x + 'px'; this.tipEl.style.top = y + 'px';
      this.canvas.style.cursor = 'pointer';
    } else { this.tipEl.hidden = true; this.canvas.style.cursor = 'grab'; }
  }

  _onClick(e) {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]); this.downAt = null;
    const fromLabel = this.downLabel; this.downLabel = null;
    if (moved > 5) return;
    const ref = fromLabel || this._pick(e);
    if (ref) {
      useStore.getState().select(ref);
      this.select(ref, { fly: true });
    } else if (useStore.getState().mode === 'free') {
      useStore.getState().select(null);
      this.select(null);
    }
  }

  // ── camera ───────────────────────────────────────────────────────────────
  _flyTo(pos, target, ms = 900) {
    this.tween = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms };
  }

  _viewPreset(name) {
    const k = this._sizeK(), v = (x, y, z) => new THREE.Vector3(x * k, y * k, z * k);
    switch (name) {
      case 'top': return [v(0, 175, 8), v(0, 0, 0)];
      case 'bottom': return [v(0, -175, 8), v(0, 0, 0)];
      case 'edge': return [v(140, 8, 40), v(0, 0, 10)];
      default: return [v(90, 115, 125), v(0, 0, 8)];
    }
  }

  _frameRefs(refs, side) {
    const box = new THREE.Box3();
    refs.forEach(r => { if (this.objs[r]) box.expandByObject(this.objs[r].group); });
    if (box.isEmpty()) return this.setView(side === 'bottom' ? 'bottom' : side === 'top' ? 'top' : 'iso');
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const rad = Math.max(size.x, size.z, 8) * 0.5;
    const dist = Math.min(220, Math.max(48, rad * 3.4 + 30));
    const dir = side === 'bottom' ? new THREE.Vector3(.35, -1, .55) : side === 'top' ? new THREE.Vector3(.3, 1, .6) : new THREE.Vector3(.6, .8, .75);
    dir.normalize();
    this._flyTo(c.clone().add(dir.multiplyScalar(dist)), c);
  }

  _frameCooler() {
    const c = this.B.COOLERS[0], [X, Z] = this._toWorld(c.x, c.y), k = Math.min(1.6, Math.max(1, c.size / 40));
    const t = new THREE.Vector3(X - 4, 20, Z - 3);
    this._flyTo(t.clone().add(new THREE.Vector3(-111, 115, 161).multiplyScalar(k)), t);
  }

  // ── highlight ────────────────────────────────────────────────────────────
  _groupColor(k) { return this._groupColors[k] || (this._groupColors[k] = new THREE.Color(css(GROUPS[k]?.color || '--c-mech'))); }

  _applyHighlight() {
    const set = this.state.highlight, sel = this.state.selected;
    Object.entries(this.objs).forEach(([ref, o]) => {
      const on = !set || set.includes(ref) || ref === sel;
      const isSel = ref === sel || (set && set.includes(ref));
      o.meshes.forEach(m => {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach(mt => {
          if (mt.userData.orig === undefined) { mt.userData.orig = { opacity: mt.opacity, transparent: mt.transparent, color: mt.color ? mt.color.clone() : null, emissive: mt.emissive ? mt.emissive.clone() : null }; }
          const transparent = !on || mt.userData.orig.transparent;
          if (mt.transparent !== transparent) { mt.transparent = transparent; mt.needsUpdate = true; }
          mt.opacity = on ? mt.userData.orig.opacity : .12; mt.depthWrite = on;
          if (mt.emissive) { if (ref === sel) mt.emissive.setHex(0x5a4410); else if (set && isSel) mt.emissive.setHex(0x1a1405); else mt.emissive.copy(mt.userData.orig.emissive); }
          if (mt.color && mt.userData.orig.color) {
            if (this.state.colorBy && o.data.group) mt.color.copy(mt.userData.orig.color).lerp(this._groupColor(o.data.subgroup || o.data.group), .65);
            else mt.color.copy(mt.userData.orig.color);
          }
        });
      });
    });
  }

  // ── visibility helpers ───────────────────────────────────────────────────
  _applyPassives(on) { Object.values(this.objs).forEach(o => { if (o.isPassive) o.group.visible = on; }); }
  _applyTP(on) { this.tpGroup.forEach(o => o.group.visible = on); }
  _applyXray(on) {
    if (!this.boardMesh) return;
    [this.boardMesh, ...this.boardGroup.userData.faces].forEach(m => { m.material.transparent = true; m.material.opacity = on ? .18 : 1; m.material.depthWrite = !on; m.material.needsUpdate = true; });
  }

  _ensureVisibleFor(ref) {
    const o = this.objs[ref]; if (!o) return;
    if (o.isPassive && !useStore.getState().showPassives) { useStore.setState({ showPassives: true }); this._applyPassives(true); }
    if (o.isTP && !useStore.getState().showTP) { useStore.setState({ showTP: true }); this._applyTP(true); }
    if (this._isCooler(ref) && !this.coolGroup.visible) { useStore.setState({ showCool: true }); this.coolGroup.visible = true; }
    if (ref === 'DSP1' && !this.oledGroup.visible) { useStore.setState({ showOled: true }); this.oledGroup.visible = true; }
  }

  // ── labels ───────────────────────────────────────────────────────────────
  _buildLabels() {
    this.LABELED = [...this.B.PARTS.filter(p => p.short).map(p => p.ref), ...this.B.COOLERS.map(c => c.ref), ...(this.B.oled ? ['DSP1'] : [])];
    this.LABELED.forEach(ref => {
      const o = this.objs[ref]; if (!o) return;
      const el = document.createElement('div'); el.className = 'tag';
      el.innerHTML = `<b>${ref}</b> ${_esc(o.data.short)}`;
      el.addEventListener('pointerdown', e => { this.canvas.dispatchEvent(new PointerEvent('pointerdown', e)); this.downLabel = ref; });
      el.addEventListener('pointerup', e => this.canvas.dispatchEvent(new PointerEvent('pointerup', e)));
      el.addEventListener('wheel', e => { e.preventDefault(); this.canvas.dispatchEvent(new WheelEvent('wheel', e)); }, { passive: false });
      el.addEventListener('contextmenu', e => e.preventDefault());
      this.labelsEl.appendChild(el); o.labelEl = el;
    });
  }

  _updateLabelAnchors() {
    this.LABELED.forEach(ref => {
      const o = this.objs[ref]; if (!o) return;
      this._box.setFromObject(o.group);
      o.labelAnchor = (o.labelAnchor || new THREE.Vector3()).set((this._box.min.x + this._box.max.x) / 2, o.side === 'top' ? this._box.max.y + 1 : this._box.min.y - 1, (this._box.min.z + this._box.max.z) / 2);
    });
    this.labelAnchorsAt = this.state.explode;
  }

  _updateLabels() {
    const show = useStore.getState().showLabels;
    if (!(Math.abs(this.state.explode - this.labelAnchorsAt) < 1e-4)) this._updateLabelAnchors();
    if (!this.labelGold) this.labelGold = css('--gold');
    this.LABELED.forEach(ref => {
      const o = this.objs[ref]; if (!o || !o.labelEl) return;
      let vis = show && this._isVisible(o.group);
      if (vis) {
        this._v.copy(o.labelAnchor);
        if (o.side === 'top') vis = this.camera.position.y > -5 || this._isCooler(ref);
        else vis = this.camera.position.y < 5;
        const { highlight, selected } = this.state;
        if (highlight && !highlight.includes(ref) && ref !== selected) vis = false;
        if (this.coolGroup.visible && this._underCooler(ref) && this.camera.position.y > 0) vis = false;
      }
      if (!vis) { o.labelEl.style.display = 'none'; return; }
      this._v.project(this.camera);
      if (this._v.z > 1) { o.labelEl.style.display = 'none'; return; }
      o.labelEl.style.display = 'block';
      o.labelEl.style.left = ((this._v.x + 1) / 2 * this.stageW) + 'px';
      o.labelEl.style.top = ((-this._v.y + 1) / 2 * this.stageH - 8) + 'px';
      o.labelEl.style.borderColor = ref === this.state.selected ? this.labelGold : '';
    });
  }

  // ── flow legend (emits to store) ─────────────────────────────────────────
  _renderFlowLegend() {
    const on = Object.entries(this.flowObjs).filter(([, f]) => f.group.visible).map(([, f]) => f.data);
    useStore.setState({ _flowLegend: on });
  }

  // ── animate ──────────────────────────────────────────────────────────────
  _animate(now = performance.now()) {
    if (!this.renderer) return;
    this._animId = requestAnimationFrame(t => this._animate(t));
    const dt = Math.min(.05, (now - this._last) / 1000); this._last = now;
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.start) / this.tween.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(this.tween.p0, this.tween.p1, e); this.controls.target.lerpVectors(this.tween.t0, this.tween.t1, e);
      if (k >= 1) this.tween = null;
    }
    this.controls.update();
    this.state.explode += (this.state.explodeTarget - this.state.explode) * Math.min(1, dt * 6);
    const ex = this.state.explode;
    Object.values(this.objs).forEach(o => {
      if (o.baseY === undefined || o.floating) return;
      const lift = (o.isPassive || o.isTP) ? 6 : 12;
      o.group.position.y = o.baseY + (o.side === 'top' ? 1 : -1) * ex * lift;
    });
    this.coolers.forEach(c => { c.group.position.y = this.SURF_T + ex * 22; c.fan.position.y = c.fanY + ex * 18; if (this.coolGroup.visible) c.blades.rotation.y += dt * 9; });
    if (this.oledGroup) this.oledGroup.position.y = this.SURF_T + 8.5 + ex * 14;
    Object.values(this.flowObjs).forEach(f => {
      if (!f.group.visible) return;
      f.parts.forEach(s => { s.userData.t = (s.userData.t + dt * f.speed * (60 / s.userData.curve.getLength())) % 1; s.position.copy(s.userData.curve.getPointAt(s.userData.t)); });
    });
    this.renderer.render(this.scene, this.camera);
    this._updateLabels();
  }

  _resize() {
    const r = this.stage.getBoundingClientRect();
    this.stageW = r.width; this.stageH = r.height;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / Math.max(1, r.height);
    this.camera.updateProjectionMatrix();
  }

  // ── store subscriptions ──────────────────────────────────────────────────
  _subscribeToStore() {
    const sub = (sel, fn) => this._unsubscribes.push(useStore.subscribe(state => sel(state), fn));

    sub(s => s.boardId, id => { this.loadBoard(id); });
    sub(s => s.showPassives, v => this._applyPassives(v));
    sub(s => s.showOled, v => { if (this.oledGroup) this.oledGroup.visible = !!this.B?.oled && v; });
    sub(s => s.showCool, v => { if (this.coolGroup) this.coolGroup.visible = v; });
    sub(s => s.showTP, v => this._applyTP(v));
    sub(s => s.xray, v => this._applyXray(v));
    sub(s => s.colorBy, v => { this.state.colorBy = v; this._applyHighlight(); });
    sub(s => s.explode, v => { this.state.explodeTarget = v ? 1 : 0; });
    sub(s => s.activeFlows, ids => this.applyFlows(ids));
    sub(s => s.cameraView, name => this.setView(name));
    sub(s => s.selected, ref => { this.state.selected = ref; this._applyHighlight(); this._updateLabels(); });
  }
}

function _esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

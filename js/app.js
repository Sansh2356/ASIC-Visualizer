/* Miner board explorer: scene, interaction, UI, guided tour. Depends on js/data.js, js/boards/*.js and three.js. */
"use strict";
/* ====================================================================
   THREE.JS SCENE
   ==================================================================== */
const stage = document.getElementById('stage');
const cv = document.getElementById('cv');
let renderer, scene, camera, controls, raycaster, pointer;
let B;                      // the board on screen (an entry of BOARDS)
let objs = {};              // ref -> {group, meshes:[], data, side, baseY}
let boardMesh, boardGroup, coolGroup, oledGroup, tpGroup, flowGroup;
let flowObjs = {};
let state = {selected:null, mode:"free", tourIdx:0, explode:0, explodeTarget:0, highlight:null, colorBy:false};

// [X, Z] in world space. When the "top" side is KiCad B.Cu, X is mirrored so the top view matches the physical board.
let MIRROR = true, SURF_T = .8, SURF_B = -.8;
function toWorld(x,y){ const X = x-B.EDGE.x0-B.BW/2; return [MIRROR ? -X : X, (y-B.EDGE.y0-B.BH/2)]; }
const sizeK = ()=> Math.max(B.BW, B.BH)/97.2; // camera distances are tuned for the Gamma; bigger boards scale up
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// seeded PRNG (mulberry32) so decorative texture detail is identical on every load
function rng(seed){ return ()=>{ seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function makeLabelTexture(text, w, h, opts={}){
  const c = document.createElement('canvas');
  const s = 16; c.width = Math.max(64, Math.round(w*s)); c.height = Math.max(32, Math.round(h*s));
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#1b1d1f'; g.fillRect(0,0,c.width,c.height);
  if(opts.grain){ const r = rng(c.width*31+c.height); for(let i=0;i<c.width*c.height/30;i++){ g.fillStyle=`rgba(255,255,255,${r()*0.04})`; g.fillRect(r()*c.width,r()*c.height,1,1);} }
  if(opts.draw) opts.draw(g,c);
  if(text){
    g.fillStyle = opts.fg || '#cfd4d2';
    let fs = Math.min(c.height*0.32, c.width/ (text.length*0.62));
    g.font = `500 ${fs}px "IBM Plex Mono", monospace`; g.textAlign='center'; g.textBaseline='middle';
    const lines = text.split('\n');
    lines.forEach((ln,i)=> g.fillText(ln, c.width/2, c.height/2 + (i-(lines.length-1)/2)*fs*1.25));
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
}

const MATS = {};
function baseMaterials(){
  MATS.ic = new THREE.MeshStandardMaterial({color:0x1d1f21, roughness:.55, metalness:.1});
  MATS.asic = new THREE.MeshStandardMaterial({color:0x2a2c30, roughness:.35, metalness:.35});
  MATS.metal = new THREE.MeshStandardMaterial({color:0xc9ccd0, roughness:.3, metalness:.9});
  MATS.inductor = new THREE.MeshStandardMaterial({color:0x2b2b2d, roughness:.7, metalness:.2});
  MATS.jack = new THREE.MeshStandardMaterial({color:0x141414, roughness:.6});
  MATS.header = new THREE.MeshStandardMaterial({color:0x181818, roughness:.6});
  MATS.pads = new THREE.MeshStandardMaterial({color:0xd8b35a, roughness:.3, metalness:.9});
  MATS.button = new THREE.MeshStandardMaterial({color:0x2a2a2a, roughness:.5});
  MATS.fanconn = new THREE.MeshStandardMaterial({color:0xe9e4d8, roughness:.6});
  MATS.cap = new THREE.MeshStandardMaterial({color:0xa48a5e, roughness:.55});
  MATS.res = new THREE.MeshStandardMaterial({color:0x1c1c1c, roughness:.6});
  MATS.term = new THREE.MeshStandardMaterial({color:0xcfd2d4, roughness:.3, metalness:.85});
  MATS.esp = new THREE.MeshStandardMaterial({color:0xc0c4c8, roughness:.28, metalness:.9});
  MATS.ecap = new THREE.MeshStandardMaterial({color:0x2a2f3a, roughness:.35, metalness:.6});
}

function init(){
  renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f0e);
  camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
  camera.position.set(95, 120, 120);
  controls = new THREE.OrbitControls(camera, cv);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.minDistance = 25; controls.maxDistance = 420;
  controls.target.set(0,0,0);
  controls.addEventListener('start', ()=>{ tween = null; }); // user input wins over a running fly-to

  scene.add(new THREE.HemisphereLight(0xdfe9e4, 0x1a1f1d, .75));
  const key = new THREE.DirectionalLight(0xffffff, .78); key.position.set(60,140,70); key.castShadow = true;
  key.shadow.mapSize.set(2048,2048); Object.assign(key.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:10,far:400});
  scene.add(key);
  const under = new THREE.DirectionalLight(0xbfd6ff, .55); under.position.set(-50,-140,-40); scene.add(under);
  const rim = new THREE.DirectionalLight(0xffe2b0, .35); rim.position.set(-120,40,-80); scene.add(rim);

  // ground grid (bench mat)
  const grid = new THREE.GridHelper(400, 40, 0x1c2622, 0x141b18); grid.position.y = -38; scene.add(grid);

  baseMaterials();

  raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();
  // hover picking is coalesced to one raycast per frame
  let moveEvt = null;
  cv.addEventListener('pointermove', e=>{ if(!moveEvt) requestAnimationFrame(()=>{ onMove(moveEvt); moveEvt = null; }); moveEvt = e; });
  cv.addEventListener('pointerdown', e=>{ downAt=[e.clientX,e.clientY]; });
  cv.addEventListener('pointerup', onClick);
  cv.addEventListener('pointerleave', ()=>{ tip.hidden = true; });
  new ResizeObserver(resize).observe(stage); resize();
  animate();
}

/* Build the scene for a board, replacing whatever board was there before. */
function buildScene(){
  if(boardGroup){
    scene.remove(boardGroup);
    // free GPU memory; a disposed shared material (MATS) is simply re-uploaded when the next board uses it
    boardGroup.traverse(m=>{ if(!m.isMesh) return; m.geometry.dispose();
      (Array.isArray(m.material)?m.material:[m.material]).forEach(mt=>{ if(mt.map) mt.map.dispose(); mt.dispose(); }); });
  }
  objs = {}; flowObjs = {}; labelsEl.innerHTML = ''; labelAnchorsAt = NaN;
  MIRROR = B.topLayer==='B'; SURF_T = B.BT/2; SURF_B = -B.BT/2;
  controls.maxDistance = 420*Math.max(1,sizeK());
  boardGroup = new THREE.Group(); scene.add(boardGroup);
  buildBoard(); buildParts(); buildPassives(); buildTestPoints(); buildCooling(); buildOled(); buildFlows();
}

/* ---------------- board ---------------- */
function boardTexture(side){
  const {EDGE, BW, BH, HOLES, ART} = B;
  const s = 12, c = document.createElement('canvas'); c.width = Math.round(BW*s); c.height = Math.round(BH*s);
  const g = c.getContext('2d');
  g.fillStyle = ART.mask || '#123d2a'; g.fillRect(0,0,c.width,c.height);
  // subtle copper pour texture (decorative, seeded so it is stable between loads)
  const rand = rng(601);
  g.globalAlpha = .18; g.fillStyle = ART.pour || '#1f6a45';
  for(let i=0;i<14*B.BW*B.BH/5568;i++){ g.fillRect(rand()*c.width, rand()*c.height, 30+rand()*180, 20+rand()*120); }
  g.globalAlpha = 1;
  // pixel coords: a face is drawn mirrored in X when it is seen from the side KiCad mirrors
  const flip = (side==='top') === MIRROR;
  const P = (x,y)=>[ flip ? (EDGE.x1-x)*s : (x-EDGE.x0)*s, (y-EDGE.y0)*s ];
  // traces (stylised, from real endpoints)
  g.strokeStyle = 'rgba(70,160,110,.55)'; g.lineWidth = 2.2; g.lineCap='round';
  (ART.traces[side]||[]).forEach(pts=>{ g.beginPath(); pts.forEach((p,i)=>{ const [a,b]=P(p[0],p[1]); i?g.lineTo(a,b):g.moveTo(a,b); }); g.stroke(); });
  if(side==='top'){
    if(ART.keepout){ // heatsink outline
      const [cx,cy,sz] = ART.keepout, h = sz/2;
      g.strokeStyle='rgba(235,240,236,.85)'; g.lineWidth=2;
      const [hx0,hy0]=P(cx+h,cy-h), [hx1,hy1]=P(cx-h,cy+h);
      g.strokeRect(Math.min(hx0,hx1),Math.min(hy0,hy1),Math.abs(hx1-hx0),Math.abs(hy1-hy0));
    }
    const L = ART.logo;
    g.fillStyle='#e6c25a'; g.font=`700 ${9*s}px "Chakra Petch", serif`; g.textAlign='center';
    const [lx,ly]=P(L.x,L.y); g.fillText(L.text, lx, ly);
    g.font=`600 ${3.2*s}px "IBM Plex Mono", monospace`; g.fillStyle='#eef2ef'; g.fillText(L.sub, lx, ly+4.6*s);
  }
  g.fillStyle='#eef2ef'; g.font=`500 ${2.2*s}px "IBM Plex Mono", monospace`; g.textAlign='center';
  (ART.silk[side]||[]).forEach(([t,x,y])=>{ const [a,b]=P(x,y); g.fillText(t,a,b); });
  // vias: decorative stitching, not from KiCad. A fresh seeded stream per call gives both faces the same
  // through-hole positions; vias that would land in or beside a mounting hole are skipped.
  g.fillStyle='rgba(216,179,90,.8)';
  const vr = rng(1370);
  for(let i=0;i<220*BW*BH/5568;i++){ const x = EDGE.x0+3+vr()*(BW-6), y = EDGE.y0+3+vr()*(BH-6);
    if(HOLES.some(([,hx,hy,d])=>Math.hypot(x-hx,y-hy) < d/2+2.2)) continue;
    const [a,b]=P(x,y); g.beginPath(); g.arc(a,b,3,0,Math.PI*2); g.fill(); }
  // thermal via array under each ASIC (real boards have a dense via field there)
  B.PARTS.filter(p=>p.mat==='asic').forEach(p=>{
    for(let i=-2;i<=2;i++) for(let j=-2;j<=2;j++){ const [a,b]=P(p.x+i*1.4,p.y+j*1.4); g.beginPath(); g.arc(a,b,5,0,Math.PI*2); g.fill(); } });
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.encoding = THREE.sRGBEncoding; return t;
}
function roundedRectShape(w,h,r){
  const s = new THREE.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s;
}
function buildBoard(){
  const {BW, BH, BT, HOLES} = B;
  const R = B.EDGE.r ?? 1.2, shape = roundedRectShape(BW,BH,R);
  HOLES.forEach(([ref,x,y,d])=>{ const [X,Z]=toWorld(x,y); const h=new THREE.Path(); h.absarc(X,-Z,d/2,0,Math.PI*2,true); shape.holes.push(h); });
  const geo = new THREE.ExtrudeGeometry(shape,{depth:BT, bevelEnabled:false, curveSegments:24});
  geo.rotateX(-Math.PI/2); geo.translate(0,-BT/2,0);
  const edgeMat = new THREE.MeshStandardMaterial({color:0x2c4f3a, roughness:.8});
  boardMesh = new THREE.Mesh(geo, edgeMat); boardMesh.receiveShadow = true; boardGroup.add(boardMesh);
  // printed faces
  const faceShape = (side)=>{ const sh = roundedRectShape(BW,BH,R);
    HOLES.forEach(([ref,x,y,d])=>{ const [X,Z]=toWorld(x,y); const h=new THREE.Path(); h.absarc(X, side==='top'?-Z:Z, d/2,0,Math.PI*2,true); sh.holes.push(h); }); return sh; };
  const mk = (side)=>{
    const top = side==='top';
    const m = new THREE.MeshStandardMaterial({map:boardTexture(side), roughness:.45, metalness:.05});
    const f = new THREE.Mesh(new THREE.ShapeGeometry(faceShape(side),24), m);
    f.rotation.x = top ? -Math.PI/2 : Math.PI/2;
    f.position.y = top ? SURF_T+0.01 : SURF_B-0.01;
    // ShapeGeometry UVs are in shape units; remap to 0..1. The bottom face is flipped in both axes so it
    // reads like KiCad (non-mirrored) when viewed from below.
    const uv = f.geometry.attributes.uv, pos = f.geometry.attributes.position;
    for(let i=0;i<uv.count;i++){ const u = (pos.getX(i)+BW/2)/BW, v = (pos.getY(i)+BH/2)/BH; uv.setXY(i, top?u:1-u, top?v:1-v); }
    f.receiveShadow = true; boardGroup.add(f); return f;
  };
  boardGroup.userData.faces = [mk('top'), mk('bottom')];
  // plated holes rings
  HOLES.forEach(([ref,x,y,d,kind])=>{
    const [X,Z]=toWorld(x,y);
    if(kind==='pad'){
      [SURF_T+0.02,SURF_B-0.02].forEach(yy=>{ const r=new THREE.Mesh(new THREE.RingGeometry(d/2,d/2+1.6,32), MATS.pads); r.rotation.x=-Math.PI/2; r.position.set(X,yy,Z); boardGroup.add(r); });
    }
    const id = registerSimple(ref, B.HOLE_TEXT[kind][0], 'mech', 'top', x,y, B.HOLE_TEXT[kind][1]);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(d/2+0.05,d/2+0.05,BT+0.1,24,1,true), new THREE.MeshStandardMaterial({color:0xb8a060,metalness:.8,roughness:.35,side:THREE.DoubleSide}));
    ring.position.set(X,0,Z); id.group.add(ring); id.meshes.push(ring); ring.userData.ref=ref;
  });
}

/* ---------------- parts ---------------- */
function addObj(ref, data, side){
  const g = new THREE.Group(); boardGroup.add(g);
  objs[ref] = {group:g, meshes:[], data, side, labelEl:null};
  return objs[ref];
}
function registerSimple(ref,name,group,side,x,y,desc){
  const data = {ref,name,group,side,x,y,what:desc, simple:true};
  return addObj(ref,data,side);
}
function rotDims(d,rot){ const r = ((rot%360)+360)%360; return (r===90||r===270) ? [d[1],d[0],d[2]] : [d[0],d[1],d[2]]; }
// Direction a part's one-sided feature (antenna, plug opening) points. p.face is a KiCad board direction
// ('+x','-x','+y','-y'); when world X is mirrored (see toWorld), KiCad ±x becomes ∓X in mesh space.
function faceOf(p){
  const f = p.face || '-x', isX = f[1]==='x', s = f[0]==='+' ? 1 : -1;
  return {axis: isX ? 'x' : 'z', sign: isX && MIRROR ? -s : s};
}

function partMesh(p){
  const [w,l,h] = rotDims(p.dims,p.rot);
  // a = distance along the face direction, c = across it
  const F = faceOf(p), len = F.axis==='x' ? w : l, wid = F.axis==='x' ? l : w;
  const xz = (a,c)=> F.axis==='x' ? [a,c] : [c,a];
  const grp = new THREE.Group();
  const add = (geo,mat,y,x=0,z=0)=>{ const m=new THREE.Mesh(geo,mat.clone()); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; grp.add(m); return m; };
  const topMatWithLabel = (base, text, opts)=>{
    const mats = []; for(let i=0;i<6;i++) mats.push(base.clone());
    mats[2] = new THREE.MeshStandardMaterial({map:makeLabelTexture(text,w,l,opts), roughness:base.roughness, metalness:base.metalness});
    return mats;
  };
  switch(p.mat){
    case 'esp': {
      add(new THREE.BoxGeometry(w,0.8,l), new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:.6}), 0.4);
      // shield can covers everything except the 6.2 mm antenna end, which points along F
      const [sw,sl] = xz(len-6.2, wid-1.2), [sx,sz] = xz(-F.sign*3.1, 0);
      const can = new THREE.Mesh(new THREE.BoxGeometry(sw,2.3,sl), topMatWithLabel(MATS.esp,"ESPRESSIF\nESP32-S3-WROOM-1\nN16R8",{bg:'#c4c8cc',fg:'#3b3f44',grain:true}));
      can.position.set(sx, 0.8+1.15, sz); can.castShadow=true; grp.add(can);
      const ant = new THREE.Mesh(new THREE.PlaneGeometry(5.6,wid-1), new THREE.MeshStandardMaterial({map:makeLabelTexture('',5.6,wid-1,{bg:'#151515',draw:(g,c)=>{g.strokeStyle='#c9a24e';g.lineWidth=6;g.beginPath();let x=c.width*.25;g.moveTo(x,c.height*.1);for(let i=0;i<7;i++){g.lineTo(x,c.height*(.15+i*.1));x = x===c.width*.25?c.width*.75:c.width*.25;g.lineTo(x,c.height*(.15+i*.1));}g.stroke();}}),roughness:.6}));
      const [ax,az] = xz(F.sign*(len/2-3), 0);
      ant.rotation.set(-Math.PI/2, 0, F.axis==='x' ? 0 : Math.PI/2); ant.position.set(ax,0.81,az); grp.add(ant);
      // castellated pads, counted from the antenna end
      const [pw,pl] = xz(0.9,0.5);
      for(let i=0;i<14;i++){ const a = F.sign*(len/2-6.5-i*1.27);
        [1,-1].forEach(s=>{ const [px,pz] = xz(a, s*wid/2); add(new THREE.BoxGeometry(pw,0.85,pl),MATS.pads,0.42,px,pz); }); }
      break; }
    case 'asic': {
      add(new THREE.BoxGeometry(w,0.25,l), new THREE.MeshStandardMaterial({color:0x3a3326,roughness:.6}), 0.12);
      const die = new THREE.Mesh(new THREE.BoxGeometry(w-1.6,0.75,l-1.6), topMatWithLabel(MATS.asic,p.mark,{bg:'#3a3d44',fg:'#c8ccd4',grain:true}));
      die.position.y = 0.25+0.37; die.castShadow=true; grp.add(die);
      // side pads: half the chip's perimeter pads per side, at its footprint pitch
      const chip = ASICS[p.mark], per = chip ? chip.pins.length/2 : 15, pitch = per>15 ? 0.48 : 0.502;
      const along = w>=l ? 'z' : 'x', half = (along==='z' ? w : l)/2+0.15;
      for(let i=0;i<per;i++){ const o=-(per-1)*pitch/2+i*pitch; [1,-1].forEach(s=>{ const pad = along==='z' ? [0.7,0.22,s*half,o] : [0.22,0.7,o,s*half];
        add(new THREE.BoxGeometry(pad[0],0.12,pad[1]),MATS.pads,0.06,pad[2],pad[3]); }); }
      break; }
    case 'tdisplay': {
      // plug-in controller module standing on two pin-header rows; screen faces up, USB-C at the F end
      const stand = h-2.6, rows = wid/2-1.3;
      [1,-1].forEach(s=>{ const [rw,rl] = xz(len*0.4, 2.5), [rx,rz] = xz(-F.sign*len*0.08, s*rows); add(new THREE.BoxGeometry(rw,stand,rl), MATS.header, stand/2, rx, rz); });
      add(new THREE.BoxGeometry(...(F.axis==='x' ? [len,1.2,wid] : [wid,1.2,len])), new THREE.MeshStandardMaterial({color:0x111214,roughness:.6}), stand+0.6);
      const [gw,gl] = xz(len*0.72, wid-3), [gx,gz] = xz(-F.sign*len*0.1, 0);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(gw,1.2,gl), [0,0,0,0,0,0].map((_,i)=> i===2 ? new THREE.MeshStandardMaterial({map:makeLabelTexture('',gw,gl,{bg:'#05070a',draw:(g,c)=>{
        g.save(); if(F.axis==='z'){ g.translate(c.width,0); g.rotate(Math.PI/2); }
        const W = F.axis==='z' ? c.height : c.width, H = F.axis==='z' ? c.width : c.height;
        g.fillStyle='#ff9f3a'; g.font=`700 ${H*.2}px "Chakra Petch",sans-serif`; g.fillText(p.screen[0], W*.06, H*.3);
        g.fillStyle='#e3ebe6'; g.font=`500 ${H*.12}px "IBM Plex Mono",monospace`; p.screen.slice(1).forEach((t,k)=>g.fillText(t, W*.06, H*(.52+k*.17)));
        g.restore(); }}),emissive:0x111111,roughness:.2}) : new THREE.MeshStandardMaterial({color:0x0c0d10,roughness:.3})));
      screen.position.set(gx, stand+1.8, gz); screen.castShadow=true; grp.add(screen);
      const [uw,ul] = xz(7.4,9), [ux,uz] = xz(F.sign*(len/2-2.6), 0);
      add(new THREE.BoxGeometry(uw,3.2,ul), MATS.metal, stand+1.2+1.6, ux, uz);
      break; }
    case 'inductor': {
      add(new THREE.BoxGeometry(w,h,l), MATS.inductor, h/2);
      add(new THREE.BoxGeometry(w-0.6,0.05,l-0.6), new THREE.MeshStandardMaterial({map:makeLabelTexture(p.mark||'',w,l,{bg:'#2e2e30',fg:'#9b9ba0'})}), h+0.02);
      add(new THREE.BoxGeometry(1.6,1.2,l*0.8),MATS.term,0.6,-w/2+0.8); add(new THREE.BoxGeometry(1.6,1.2,l*0.8),MATS.term,0.6,w/2-0.8);
      break; }
    case 'jack': {
      add(new THREE.BoxGeometry(w,h,l), p.color ? new THREE.MeshStandardMaterial({color:p.color, roughness:.55}) : MATS.jack, h/2);
      // plug opening and centre pin on the F end
      const axial = g=> F.axis==='x' ? g.rotateZ(Math.PI/2) : g.rotateX(Math.PI/2);
      const bore = new THREE.Mesh(axial(new THREE.CylinderGeometry(2.9,2.9,1,24)), new THREE.MeshStandardMaterial({color:0x050505}));
      const [bx,bz] = xz(F.sign*(len/2+0.01), 0); bore.position.set(bx,h/2+0.5,bz);
      grp.add(bore);
      const [cx,cz] = xz(F.sign*(len/2-0.2), 0);
      add(axial(new THREE.CylinderGeometry(1.05,1.05,1.2,16)), MATS.term, h/2+0.5, cx, cz);
      break; }
    case 'header': {
      add(new THREE.BoxGeometry(w,2.5,l), MATS.header, 1.25);
      const pitch = p.pitch || 2.54, n = Math.round(Math.max(w,l)/pitch);
      for(let i=0;i<n;i++){ const off=-((n-1)*pitch)/2+i*pitch; const pin=new THREE.BoxGeometry(0.64,h,0.64);
        if(w>l) add(pin,MATS.pads,h/2,off,0); else add(pin,MATS.pads,h/2,0,off); }
      break; }
    case 'fanconn': {
      add(new THREE.BoxGeometry(w,h,l), MATS.fanconn, h/2);
      const n=p.pins||4, L=Math.max(w,l), pitch=p.pitch||(L>8?2.54:1);
      for(let i=0;i<n;i++){ const off=-((n-1)*pitch)/2+i*pitch; add(new THREE.BoxGeometry(0.6,h*0.8,0.6),MATS.pads,h*0.55, w>=l?off:0, w>=l?0:off); }
      break; }
    case 'button': {
      add(new THREE.BoxGeometry(w,1,l), MATS.button, 0.5);
      add(new THREE.CylinderGeometry(0.9,0.9,0.9,20), new THREE.MeshStandardMaterial({color:0x111111}), 1.4);
      break; }
    case 'pads': {
      if(p.shape==='tagconnect'){ for(let i=0;i<3;i++) for(let j=0;j<2;j++) add(new THREE.CylinderGeometry(0.4,0.4,0.06,16),MATS.pads,0.03,-1.27+i*1.27,-0.635+j*1.27); }
      else add(new THREE.BoxGeometry(w,0.06,l),MATS.pads,0.03);
      break; }
    case 'metal': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w,h,l), MATS.metal.clone()); body.position.y=h/2; body.castShadow=true; grp.add(body);
      if(p.shape==='usbc'){ const [mw,ml] = xz(0.4,6.2), [mx,mz] = xz(F.sign*(len/2+0.01),0);
        const mouth=new THREE.Mesh(new THREE.BoxGeometry(mw,1.6,ml), new THREE.MeshStandardMaterial({color:0x050505})); mouth.position.set(mx,h/2,mz); grp.add(mouth); }
      break; }
    default: { // ic
      const mats = topMatWithLabel(MATS.ic, p.mark||p.ref, {bg:'#1d1f22', fg:'#8e9499'});
      const b = new THREE.Mesh(new THREE.BoxGeometry(w,h,l), mats); b.position.y=h/2; b.castShadow=true; grp.add(b);
      // leads
      const isLong = Math.max(w,l);
      if(p.leads!==false && !/QFN|SON/.test(p.pkg)){
        const along = w>=l ? 'x':'z', n = Math.max(2, Math.round(isLong/0.95));
        for(let i=0;i<Math.min(n,8);i++){ const off=-isLong/2+0.5+i*(isLong-1)/Math.max(1,Math.min(n,8)-1);
          const lead = new THREE.BoxGeometry(along==='x'?0.25:0.5, 0.15, along==='x'?0.5:0.25);
          if(along==='x'){ add(lead,MATS.term,0.08,off, l/2+0.2); add(lead,MATS.term,0.08,off,-l/2-0.2); }
          else { add(lead,MATS.term,0.08, w/2+0.2,off); add(lead,MATS.term,0.08,-w/2-0.2,off); } }
      }
    }
  }
  return grp;
}

function placeGroup(o, x, y, side, inner){
  const [X,Z] = toWorld(x,y);
  o.group.position.set(X, side==='top'?SURF_T:SURF_B, Z);
  if(side==='bottom') inner.rotation.x = Math.PI; // hang below board
  o.group.add(inner);
  o.baseY = o.group.position.y;
  inner.traverse(m=>{ if(m.isMesh){ o.meshes.push(m); m.userData.ref=o.data.ref; } });
}

function buildParts(){
  B.PARTS.forEach(p=>{
    const o = addObj(p.ref, p, p.side);
    placeGroup(o, p.x, p.y, p.side, partMesh(p));
  });
}
function buildPassives(){
  B.PASSIVES.forEach(([ref,val,size,x,y,rot,nets,group,role,side])=>{
    const isR = ref[0]==='R', can = size.startsWith('CP');
    const dnp = val==='DNP';
    const kind = isR ? 'Resistor ' : can ? 'Electrolytic capacitor ' : 'Capacitor ';
    const data = {ref, name: kind+val, part: kind+val+' · '+size, pkg:(can ? 'Ø'+size.slice(2).replace('x',' × ')+' mm can' : size)+' SMD', group:'passive', subgroup:group, side, x,y, rot, what:role, netsStr:nets, passive:true, dnp};
    const o = addObj(ref,data,side);
    const d = rotDims(PKG[size], rot);
    const grp = new THREE.Group();
    if(can){
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(d[0],0.8,d[1]), MATS.header.clone())).position.y = 0.4;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(d[0]/2-0.15,d[0]/2-0.15,d[2]-0.8,28), MATS.ecap.clone());
      body.position.y = 0.8+(d[2]-0.8)/2; body.castShadow = true; grp.add(body);
    } else if(!dnp){
      const body = new THREE.Mesh(new THREE.BoxGeometry(d[0]*(d[0]>d[1]?0.7:1), d[2], d[1]*(d[1]>d[0]?0.7:1)), (isR?MATS.res:MATS.cap).clone());
      body.position.y = d[2]/2; body.castShadow = true; grp.add(body);
      const along = d[0]>=d[1];
      [-1,1].forEach(s=>{ const t=new THREE.Mesh(new THREE.BoxGeometry(along?d[0]*0.16:d[0], d[2]*1.02, along?d[1]:d[1]*0.16), MATS.term.clone());
        t.position.set(along?s*d[0]*0.42:0, d[2]/2, along?0:s*d[1]*0.42); grp.add(t); });
    } else {
      [-1,1].forEach(s=>{ const along=d[0]>=d[1]; const t=new THREE.Mesh(new THREE.BoxGeometry(along?0.4:d[0],0.04,along?d[1]:0.4), MATS.pads.clone()); t.position.set(along?s*d[0]*0.35:0,0.02,along?0:s*d[1]*0.35); grp.add(t); });
    }
    placeGroup(o, x, y, side, grp);
    o.isPassive = true;
  });
}
function buildTestPoints(){
  tpGroup = [];
  B.TPS.forEach(([ref,x,y,net,side])=>{
    const data = {ref, name:'Test point · '+net, part:'Test pad', pkg:'TestPoint_Pad', group:'test', side, x,y, what:`Bare copper pad on the ${net} net. Touch a multimeter or scope probe here to measure the signal or rail while debugging.`, netsStr:net, tp:true};
    const o = addObj(ref,data,side);
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,0.08,20), MATS.pads.clone()); m.position.y=0.04; grp.add(m);
    placeGroup(o,x,y,side,grp); o.group.visible = false; o.isTP = true; tpGroup.push(o);
  });
}

/* ---------------- cooling ---------------- */
// Heatsink + fan stacks from B.COOLERS, all under one group so the "Heatsink + fan" option toggles them together.
let coolers = [];
function buildCooling(){
  coolGroup = new THREE.Group(); boardGroup.add(coolGroup); coolGroup.visible = false;
  coolers = B.COOLERS.map(c=>{
    const grp = new THREE.Group(); coolGroup.add(grp);
    const [X,Z] = toWorld(c.x, c.y), S = c.size, k = c.fan/40;
    grp.position.set(X, SURF_T, Z);
    const al = new THREE.MeshStandardMaterial({color:0xb9bec3, metalness:.85, roughness:.35});
    const base = new THREE.Mesh(new THREE.BoxGeometry(S,3,S), al); base.position.y = 1.0+1.5; base.castShadow=true; grp.add(base);
    const pitch = (S-3)/(c.fins-1);
    for(let i=0;i<c.fins;i++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(1.1,c.finH,S), al); fin.position.set(-S/2+1.5+i*pitch, 1+3+c.finH/2, 0); fin.castShadow=true; grp.add(fin); }
    const fan = new THREE.Group(); fan.position.y = 1+3+c.finH; grp.add(fan);
    const frameMat = new THREE.MeshStandardMaterial({color:0x8a8172, roughness:.8});
    const r = c.fan/2, frame = new THREE.Shape(); frame.moveTo(-r,-r); frame.lineTo(r,-r); frame.lineTo(r,r); frame.lineTo(-r,r); frame.lineTo(-r,-r);
    const hole = new THREE.Path(); hole.absarc(0,0,r*0.93,0,Math.PI*2,true); frame.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(frame,{depth:10,bevelEnabled:false,curveSegments:40}); fg.rotateX(-Math.PI/2);
    const fm = new THREE.Mesh(fg, frameMat); fm.castShadow=true; fan.add(fm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(7*k,7*k,8,32), new THREE.MeshStandardMaterial({color:0x5a3d31,roughness:.7})); hub.position.y=5; fan.add(hub);
    const blades = new THREE.Group(); blades.position.y = 5; fan.add(blades);
    const bm = new THREE.MeshStandardMaterial({color:0x6a4638, roughness:.65, side:THREE.DoubleSide});
    for(let i=0;i<9;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(11*k,0.6,5.5*k), bm); b.position.set(Math.cos(i/9*Math.PI*2)*12.5*k,0,Math.sin(i/9*Math.PI*2)*12.5*k); b.rotation.y=-i/9*Math.PI*2; b.rotation.x=.45; blades.add(b); }
    const o = {group:grp, meshes:[], data:{ref:c.ref, simple:true, ...c.data}, side:'top', floating:true, baseY:SURF_T};
    grp.traverse(m=>{ if(m.isMesh){ o.meshes.push(m); m.userData.ref=c.ref; } });
    objs[c.ref] = o;
    return {spec:c, group:grp, fan, blades, fanY:fan.position.y};
  });
}
const isCooler = ref => B.COOLERS.some(c=>c.ref===ref);
const underCooler = ref => B.COOLERS.some(c=>c.under.includes(ref));
function buildOled(){
  oledGroup = new THREE.Group(); boardGroup.add(oledGroup);
  if(!B.oled) return;
  const [hx,hz] = toWorld(B.oled.x,B.oled.y);
  oledGroup.position.set(hx-15.5, SURF_T+8.5, hz+5.6);
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(38,1.2,12), new THREE.MeshStandardMaterial({color:0x1d4fa8,roughness:.6})); pcb.castShadow=true; oledGroup.add(pcb);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(30,1.4,11.4), [0,0,0,0,0,0].map((_,i)=> i===2 ? new THREE.MeshStandardMaterial({map:makeLabelTexture('',30,11.4,{bg:'#05070a',draw:(g,c)=>{g.fillStyle='#57b7ff';g.font=`500 ${c.height*.17}px "IBM Plex Mono",monospace`;['Gh: 1206.1  J/Th: 14','A/R: 22985/59','UT: 2d 11h 53m','BD: 60.4M'].forEach((t,i)=>g.fillText(t,c.width*.06,c.height*(.24+i*.21)));}}),emissive:0x0d2a44,roughness:.2}) : new THREE.MeshStandardMaterial({color:0x111418,roughness:.2})));
  glass.position.set(-2.5,1.2,0); oledGroup.add(glass);
  const o = {group:oledGroup, meshes:[], data:{ref:'DSP1', short:'OLED', name:'0.91" OLED module', group:'io', side:'top', simple:true, part:'SSD1306 128 × 32 I2C OLED', what:`The plug-in status display. It sits on the ${B.oled.header} header and shows hashrate, efficiency, shares, uptime and best difficulty. The firmware drives it at I2C address 0x3C. The values shown here are sample readings.`, specs:[["Controller","SSD1306"],["Resolution","128 × 32"],["Bus","I2C 0x3C (3.3 V)"]]}, side:'top', floating:true};
  oledGroup.traverse(m=>{ if(m.isMesh){ o.meshes.push(m); m.userData.ref='DSP1'; } });
  objs['DSP1']=o; o.baseY = oledGroup.position.y;
}

/* ---------------- flows ---------------- */
function flowCurve(pts){
  const v = pts.map(([x,y,s])=>{ const [X,Z]=toWorld(x,y); return new THREE.Vector3(X, s==='t'? SURF_T+2.2 : SURF_B-2.2, Z); });
  return new THREE.CatmullRomCurve3(v, false, 'centripetal', .5);
}
function buildFlows(){
  flowGroup = new THREE.Group(); boardGroup.add(flowGroup);
  B.FLOWS.forEach(f=>{
    const g = new THREE.Group(); g.visible=false; flowGroup.add(g);
    const curves = (f.multi || [f.pts]).map(flowCurve);
    const col = new THREE.Color(f.color);
    const parts = [];
    curves.forEach(c=>{
      const tube = new THREE.Mesh(new THREE.TubeGeometry(c, 80, .18, 6, false), new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.35, depthWrite:false}));
      g.add(tube);
      for(let i=0;i<f.n;i++){
        const s = new THREE.Mesh(new THREE.SphereGeometry(.55,10,8), new THREE.MeshBasicMaterial({color:col}));
        s.userData = {curve:c, t:i/f.n}; g.add(s); parts.push(s);
      }
    });
    flowObjs[f.id] = {group:g, parts, speed:f.speed, data:f};
  });
}

/* ====================================================================
   INTERACTION
   ==================================================================== */
const tip = document.getElementById('tip');
let downAt = null, downLabel = null; // downLabel: ref of the label a press started on
function pick(e){
  const r = cv.getBoundingClientRect();
  pointer.x = ((e.clientX-r.left)/r.width)*2-1; pointer.y = -((e.clientY-r.top)/r.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  // visibility is only ever toggled per part group, so test the ~200 groups rather than walking every mesh
  const cand = []; for(const ref in objs){ const o = objs[ref]; if(isVisible(o.group)) cand.push(...o.meshes); }
  // the PCB occludes parts on the far side, unless X-ray makes it see-through
  if(!document.getElementById('oXray').checked) cand.push(boardMesh, ...boardGroup.userData.faces);
  const hits = raycaster.intersectObjects(cand, false);
  return hits.length ? hits[0].object.userData.ref || null : null;
}
function isVisible(m){ let o=m; while(o){ if(!o.visible) return false; o=o.parent; } return true; }
function onMove(e){
  if(e.buttons){ tip.hidden = true; return; } // orbiting or panning: no hover feedback needed
  const ref = pick(e);
  if(ref && objs[ref]){
    const d = objs[ref].data, r = stage.getBoundingClientRect();
    tip.innerHTML = `<code>${d.ref}</code>${esc(d.name)}`;
    tip.hidden = false;
    let x = e.clientX-r.left+14, y = e.clientY-r.top+14;
    if(x > r.width-270) x -= 290;
    tip.style.left = x+'px'; tip.style.top = y+'px';
    cv.style.cursor='pointer';
  } else { tip.hidden = true; cv.style.cursor='grab'; }
}
function onClick(e){
  if(!downAt) return; const moved = Math.hypot(e.clientX-downAt[0], e.clientY-downAt[1]); downAt=null;
  const fromLabel = downLabel; downLabel = null;
  if(moved>5) return;
  const ref = fromLabel || pick(e);
  if(ref) select(ref, {fly:true}); else if(state.mode==='free') select(null);
}

/* camera tween */
let tween = null;
function flyTo(pos, target, ms=900){
  tween = {p0:camera.position.clone(), t0:controls.target.clone(), p1:pos, t1:target, start:performance.now(), ms};
}
function viewPreset(name){
  const k = sizeK(), v = (x,y,z)=>new THREE.Vector3(x*k,y*k,z*k);
  switch(name){
    case 'top': return [v(0,175,8), v(0,0,0)];
    case 'bottom': return [v(0,-175,8), v(0,0,0)];
    case 'edge': return [v(140,8,40), v(0,0,10)];
    default: return [v(90,115,125), v(0,0,8)];
  }
}
function setView(name, instant){
  document.querySelectorAll('#views button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.view===name));
  const [p,t] = viewPreset(name);
  if(instant){ camera.position.copy(p); controls.target.copy(t); } else flyTo(p,t);
}
function frameRefs(refs, side){
  const box = new THREE.Box3();
  refs.forEach(r=>{ if(objs[r]) box.expandByObject(objs[r].group); });
  if(box.isEmpty()) return setView(side==='bottom'?'bottom':side==='top'?'top':'iso');
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const rad = Math.max(size.x,size.z,8)*0.5;
  const dist = Math.min(220, Math.max(48, rad*3.4 + 30));
  const dir = side==='bottom' ? new THREE.Vector3(.35,-1,.55) : side==='top' ? new THREE.Vector3(.3,1,.6) : new THREE.Vector3(.6,.8,.75);
  dir.normalize();
  flyTo(c.clone().add(dir.multiplyScalar(dist)), c);
}

/* highlight / dim */
const _groupColors = {};
function groupColor(k){ return _groupColors[k] || (_groupColors[k] = new THREE.Color(css(GROUPS[k]?.color || '--c-mech'))); }
function applyHighlight(){
  const set = state.highlight; // array of refs or null
  const sel = state.selected;
  Object.entries(objs).forEach(([ref,o])=>{
    const on = !set || set.includes(ref) || ref===sel;
    const isSel = ref===sel || (set && set.includes(ref));
    o.meshes.forEach(m=>{
      const mats = Array.isArray(m.material)? m.material : [m.material];
      mats.forEach(mt=>{
        if(mt.userData.orig===undefined){ mt.userData.orig = {opacity:mt.opacity, transparent:mt.transparent, color: mt.color? mt.color.clone():null, emissive: mt.emissive? mt.emissive.clone():null}; }
        const transparent = !on || mt.userData.orig.transparent;
        if(mt.transparent !== transparent){ mt.transparent = transparent; mt.needsUpdate = true; } // only this can change the shader
        mt.opacity = on ? mt.userData.orig.opacity : .12;
        mt.depthWrite = on;
        if(mt.emissive){ if(ref===sel) mt.emissive.setHex(0x5a4410); else if(set && isSel) mt.emissive.setHex(0x1a1405); else mt.emissive.copy(mt.userData.orig.emissive); }
        if(mt.color && mt.userData.orig.color){
          if(state.colorBy && o.data.group){
            // passives take the colour of the subsystem they serve, not the generic "Passives" grey
            mt.color.copy(mt.userData.orig.color).lerp(groupColor(o.data.subgroup || o.data.group), .65);
          } else mt.color.copy(mt.userData.orig.color);
        }
      });
    });
  });
}

/* ====================================================================
   LABELS (projected HTML)
   ==================================================================== */
const labelsEl = document.getElementById('labels');
let LABELED = [];
function buildLabels(){
  LABELED = [...B.PARTS.filter(p=>p.short).map(p=>p.ref), ...B.COOLERS.map(c=>c.ref), ...(B.oled ? ['DSP1'] : [])];
  LABELED.forEach(ref=>{
    const o = objs[ref]; if(!o) return;
    const el = document.createElement('div'); el.className='tag';
    el.innerHTML = `<b>${ref}</b> ${esc(o.data.short)}`;
    // Forward input to the canvas so drags and zooms that start on a label still move the camera;
    // onClick selects this label's part if the press turns out to be a click.
    el.addEventListener('pointerdown', e=>{ cv.dispatchEvent(new PointerEvent('pointerdown', e)); downLabel = ref; });
    el.addEventListener('pointerup', e=>cv.dispatchEvent(new PointerEvent('pointerup', e))); // only reached if capture failed
    el.addEventListener('wheel', e=>{ e.preventDefault(); cv.dispatchEvent(new WheelEvent('wheel', e)); }, {passive:false});
    el.addEventListener('contextmenu', e=>e.preventDefault()); // right-drag pans, like on the canvas
    labelsEl.appendChild(el); o.labelEl = el;
  });
}
const _v = new THREE.Vector3(), _box = new THREE.Box3();
let labelAnchorsAt = NaN, labelGold = ''; // explode value the cached anchors were computed for
// World point each label hangs from: above a top-side part, below a bottom-side one. Geometry only moves
// when the explode animation runs, so anchors are recomputed then and not every frame.
function updateLabelAnchors(){
  LABELED.forEach(ref=>{
    const o = objs[ref]; if(!o) return;
    _box.setFromObject(o.group);
    o.labelAnchor = (o.labelAnchor || new THREE.Vector3()).set((_box.min.x+_box.max.x)/2, o.side==='top' ? _box.max.y+1 : _box.min.y-1, (_box.min.z+_box.max.z)/2);
  });
  labelAnchorsAt = state.explode;
}
function updateLabels(){
  const show = document.getElementById('oLabels').checked;
  if(!(Math.abs(state.explode - labelAnchorsAt) < 1e-4)) updateLabelAnchors();
  if(!labelGold) labelGold = css('--gold');
  LABELED.forEach(ref=>{
    const o = objs[ref]; if(!o||!o.labelEl) return;
    let vis = show && isVisible(o.group);
    if(vis){
      _v.copy(o.labelAnchor);
      if(o.side==='top') vis = camera.position.y > -5 || isCooler(ref);
      else vis = camera.position.y < 5;
      if(state.highlight && !state.highlight.includes(ref) && ref!==state.selected) vis=false;
      if(coolGroup.visible && underCooler(ref) && camera.position.y>0) vis = false;
    }
    if(!vis){ o.labelEl.style.display='none'; return; }
    _v.project(camera);
    if(_v.z>1){ o.labelEl.style.display='none'; return; }
    o.labelEl.style.display='block';
    o.labelEl.style.left = ((_v.x+1)/2*stageW)+'px';
    o.labelEl.style.top = ((-_v.y+1)/2*stageH - 8)+'px';
    o.labelEl.style.borderColor = ref===state.selected ? labelGold : '';
  });
}

/* ====================================================================
   ANIMATE
   ==================================================================== */
let last = performance.now();
function animate(now=performance.now()){
  requestAnimationFrame(animate);
  const dt = Math.min(.05,(now-last)/1000); last = now;
  if(tween){
    const k = Math.min(1,(now-tween.start)/tween.ms), e = k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
    camera.position.lerpVectors(tween.p0,tween.p1,e); controls.target.lerpVectors(tween.t0,tween.t1,e);
    if(k>=1) tween=null;
  }
  controls.update();
  // explode
  state.explode += (state.explodeTarget - state.explode)*Math.min(1,dt*6);
  const ex = state.explode;
  Object.values(objs).forEach(o=>{
    if(o.baseY===undefined || o.floating) return;
    const lift = (o.isPassive||o.isTP) ? 6 : 12;
    o.group.position.y = o.baseY + (o.side==='top'? 1 : -1) * ex * lift;
  });
  coolers.forEach(c=>{ c.group.position.y = SURF_T + ex*22; c.fan.position.y = c.fanY + ex*18; if(coolGroup.visible) c.blades.rotation.y += dt*9; });
  if(oledGroup){ oledGroup.position.y = SURF_T+8.5 + ex*14; }
  // flows
  Object.values(flowObjs).forEach(f=>{
    if(!f.group.visible) return;
    f.parts.forEach(s=>{ s.userData.t = (s.userData.t + dt*f.speed* (60/ s.userData.curve.getLength())) % 1; s.position.copy(s.userData.curve.getPointAt(s.userData.t)); });
  });
  renderer.render(scene,camera);
  updateLabels();
}
let stageW = 1, stageH = 1;
function resize(){
  const r = stage.getBoundingClientRect(); stageW = r.width; stageH = r.height;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width/Math.max(1,r.height); camera.updateProjectionMatrix();
}

/* ====================================================================
   UI: lists, inspector, options, tour, diagram
   ==================================================================== */
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function allItems(){
  return Object.values(objs).map(o=>o.data).filter(d=>d.ref);
}
function renderList(){
  const q = document.getElementById('search').value.trim().toLowerCase();
  const list = document.getElementById('list'); list.innerHTML='';
  const items = allItems().filter(d=> !q || [d.ref,d.name,d.part||'',d.what||'',d.netsStr||''].join(' ').toLowerCase().includes(q));
  const order = ['asic','power','control','thermal','io','passive','test','mech'];
  order.forEach(gk=>{
    const its = items.filter(d=>d.group===gk).sort((a,b)=> a.ref.localeCompare(b.ref, undefined, {numeric:true}));
    if(!its.length) return;
    const sec = document.createElement('div'); sec.className='group';
    sec.innerHTML = `<h4><i style="background:var(${GROUPS[gk].color})"></i>${GROUPS[gk].name}<small>${its.length}</small></h4>`;
    its.forEach(d=>{
      const b = document.createElement('button'); b.className='item'; b.dataset.ref=d.ref;
      b.setAttribute('aria-current', d.ref===state.selected);
      b.innerHTML = `<code>${d.ref}</code><span>${esc(d.passive? d.name+' · '+(d.netsStr||'') : d.name)}</span>`;
      b.addEventListener('click',()=>select(d.ref,{fly:true}));
      sec.appendChild(b);
    });
    list.appendChild(sec);
  });
  document.getElementById('partCount').textContent = partCount(B);
}

function ensureVisibleFor(ref){
  const o = objs[ref]; if(!o) return;
  if(o.isPassive && !document.getElementById('oPassive').checked){ document.getElementById('oPassive').checked = true; applyPassives(); }
  if(o.isTP && !document.getElementById('oTP').checked){ document.getElementById('oTP').checked = true; applyTP(); }
  if(isCooler(ref) && !coolGroup.visible){ document.getElementById('oCool').checked = true; coolGroup.visible = true; }
  if(ref==='DSP1' && !oledGroup.visible){ document.getElementById('oOled').checked = true; oledGroup.visible = true; }
}
function select(ref, opts={}){
  state.selected = ref;
  if(ref){ ensureVisibleFor(ref); if(opts.fly){ const o=objs[ref]; frameRefs([ref], o.side==='bottom'?'bottom':'top'); } }
  if(state.mode==='free') state.highlight = null;
  applyHighlight();
  renderInspector();
  document.querySelectorAll('#list .item').forEach(b=>b.setAttribute('aria-current', b.dataset.ref===ref));
  const cur = document.querySelector(`#list .item[data-ref="${ref}"]`); if(cur) cur.scrollIntoView({block:'nearest'});
}

function renderInspector(){
  const el = document.getElementById('insp');
  const ref = state.selected;
  if(!ref){ el.innerHTML = overviewHTML(); bindOverview(); return; }
  const d = objs[ref].data;
  const g = GROUPS[d.group] || GROUPS.mech;
  let h = `<div class="kick"><span class="chip" style="color:var(${g.color})">${g.name}${d.subgroup? ' · '+GROUPS[d.subgroup].name:''}</span><span class="ref">${d.ref} · ${d.side==='top'?'top side':'bottom side'}</span></div>
  <h2>${esc(d.name)}</h2>${d.part? `<div class="pn">${esc(d.part)}${d.pkg? ' · '+esc(d.pkg):''}</div>`:''}`;
  if(d.dnp) h += `<p class="note">Not populated in the BOM. The footprint is a design option.</p>`;
  h += `<h3>What it does</h3><p>${esc(d.what||'')}</p>`;
  if(d.how) h += `<h3>How it works on the ${B.tab}</h3><p>${esc(d.how)}</p>`;
  if(d.specs && d.specs.length) h += `<h3>Key facts</h3><dl class="kv">${d.specs.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  if(d.nets) h += `<h3>Connected nets</h3><div class="nets">${d.nets.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`;
  if(d.netsStr && !d.nets) h += `<h3>Connected nets</h3><div class="nets">${d.netsStr.split('/').map(n=>`<span>${esc(n)}</span>`).join('')}</div>`;
  if(d.mat==='asic') h += asicExtras();
  if(d.note) h += `<p class="note">${esc(d.note)}</p>`;
  if(d.links) h += `<h3>Source</h3><div class="links">${d.links.map(([t,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>`;
  h += `<h3>Board position</h3><dl class="kv"><dt>KiCad X, Y</dt><dd>${(+d.x).toFixed(2)}, ${(+d.y).toFixed(2)} mm</dd>${d.rot!==undefined?`<dt>Rotation</dt><dd>${d.rot}°</dd>`:''}</dl>`;
  h += `<p style="margin-top:14px"><button class="btn" id="backOv">← Board overview</button></p>`;
  el.innerHTML = h;
  document.getElementById('backOv').onclick = ()=>select(null);
  if(d.mat==='asic') bindCalc();
  el.parentElement.scrollTop = 0;
}

function asicExtras(){
  const {freqs, def, count, chip} = B.asic, n = ASICS[chip].smallCores;
  return `<h3>Hashrate calculator</h3>
  <div class="calc">
    <label for="fq"><span>ASIC frequency</span><span id="fqv">${def} MHz</span></label>
    <input type="range" id="fq" min="0" max="${freqs.length-1}" step="1" value="${freqs.indexOf(def)}" aria-label="Frequency">
    <div class="big" id="hr"></div>
    <small>hashrate ≈ frequency × ${n} small cores${count>1 ? ` × ${count} chips` : ''}. PLL multiplier from the ${ASICS[chip].clock} MHz clock: <span id="pll"></span>. Firmware presets: ${freqs.join(', ')} MHz.</small>
  </div>
  <h3>Pinout (from the KiCad footprint)</h3>
  <div class="pinout">${pinoutSVG()}</div>`;
}
function bindCalc(){
  const {freqs, count, chip} = B.asic, A = ASICS[chip];
  const fq = document.getElementById('fq');
  const upd = ()=>{ const f = freqs[+fq.value]; document.getElementById('fqv').textContent = f+' MHz'; document.getElementById('hr').textContent = (f*A.smallCores*count/1e6).toFixed(3)+' TH/s'; document.getElementById('pll').textContent = '×'+(f/A.clock).toFixed(1).replace(/\.0$/,''); };
  fq.addEventListener('input',upd); upd();
}
// signal colours live on FLOWS so the 3D flows, diagram and pinout always agree
function flowColor(id){ return id==='asic' ? css('--c-asic') : B.FLOWS.find(f=>f.id===id).color; }
function pinoutSVG(){
  const A = ASICS[B.asic.chip], N = A.pins.length, half = N/2;
  const colors = {tap:'var(--c-power)',gnd:'var(--c-passive)',ctl:'var(--c-control)',clk:flowColor('clk'),strap:'var(--muted)',io:flowColor('rails'),temp:'var(--c-thermal)',chain:'var(--c-io)'};
  const W=340, H=330, bx=120, bw=100, by=20, bh=290, step = Math.min(18.6, 262/(half-1));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${B.asic.chip} pinout">`;
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="var(--panel-2)" stroke="var(--line)"/>`;
  // exposed centre pads: a short one on top (VDD) and a tall one below (VSS), as on the footprint
  const [[n1,name1,cap1,col1],[n2,name2,cap2,col2]] = A.exposed;
  s += `<rect x="${bx+14}" y="${by+20}" width="${bw-28}" height="60" rx="3" fill="none" stroke="var(${col1})" stroke-dasharray="3 3"/>`;
  s += `<text x="${bx+bw/2}" y="${by+46}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="var(${col1})">${n1} · ${name1}</text><text x="${bx+bw/2}" y="${by+62}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--muted)">${cap1}</text>`;
  s += `<rect x="${bx+14}" y="${by+92}" width="${bw-28}" height="170" rx="3" fill="none" stroke="var(${col2})" stroke-dasharray="3 3"/>`;
  s += `<text x="${bx+bw/2}" y="${by+176}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="var(${col2})">${n2} · ${name2}</text><text x="${bx+bw/2}" y="${by+192}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--muted)">${cap2}</text>`;
  A.pins.forEach(([n,name,k])=>{
    const left = n<=half, i = left? n-1 : N-n;
    const y = by+14+i*step;
    const x0 = left? bx-10 : bx+bw, col = colors[k];
    s += `<rect x="${x0}" y="${y-3}" width="10" height="6" fill="${col}"/>`;
    s += `<text x="${left? x0-4 : x0+14}" y="${y+3.5}" text-anchor="${left?'end':'start'}" font-family="IBM Plex Mono" font-size="10" fill="var(--fg)">${n} ${name}</text>`;
  });
  s += `</svg>`;
  s += `<p style="font-size:12px;color:var(--muted);margin-top:6px"><span style="color:var(--c-control)">■</span> control (CI/RO/reset/BI) · <span style="color:${colors.clk}">■</span> clock · <span style="color:${colors.io}">■</span> I/O rails · <span style="color:var(--c-power)">■</span> domain taps · <span style="color:var(--c-thermal)">■</span> temp diode · <span style="color:var(--muted)">■</span> straps · <span style="color:var(--c-io)">■</span> chain outputs to the next chip${B.asic.count>1 ? '' : ' (test points only on a single-chip board)'}</p>`;
  return s;
}

const SUBSYS_LABEL = {asic:'Hashing', power:'Power', control:'Control', thermal:'Thermal', io:'I/O'};
function overviewHTML(){
  const O = B.overview, link = ([t,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`;
  return `<div class="overview">
  <div class="kick"><span class="chip" style="color:var(--gold)">Overview</span><span class="ref">${O.kick}</span></div>
  <h2>${O.h2}</h2>
  <p>${O.intro}</p>
  <div class="ov-grid">
    ${O.grid.map(([b,t])=>`<div><b>${b}</b><span>${t}</span></div>`).join('')}
    <div><b>${partCount(B)}</b><span>populated parts</span></div>
  </div>
  <h3>Subsystems</h3>
  <dl class="kv">${O.subsystems.map(([g,t])=>`<dt style="color:var(${GROUPS[g].color})">${SUBSYS_LABEL[g]}</dt><dd>${t}</dd>`).join('')}</dl>
  <h3>Start here</h3>
  <p><button class="btn primary" id="startTour">Start guided tour</button> <button class="btn" id="openAsic">Open the ASIC</button></p>
  <h3>PCB construction</h3>
  <dl class="kv"><dt>Size</dt><dd>${B.BW.toFixed(1)} × ${B.BH.toFixed(1)} mm</dd>${O.construction.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
  <h3>Sources</h3>
  <div class="links">${O.links.map(link).join('')}</div>
  <p class="note">${O.note}</p>
  </div>`;
}
function bindOverview(){
  const s = document.getElementById('startTour'); if(s) s.onclick = ()=>setMode('tour');
  const a = document.getElementById('openAsic'); if(a) a.onclick = ()=>select(B.PARTS.find(p=>p.mat==='asic').ref,{fly:true});
}

/* options */
function applyPassives(){ const on = document.getElementById('oPassive').checked; Object.values(objs).forEach(o=>{ if(o.isPassive) o.group.visible = on; }); }
function applyTP(){ const on = document.getElementById('oTP').checked; tpGroup.forEach(o=> o.group.visible = on); }
function applyFlows(ids){
  Object.entries(flowObjs).forEach(([id,f])=>{ const on = ids.includes(id); f.group.visible = on; const cb=document.getElementById('f_'+id); if(cb) cb.checked = on; });
  renderLegend();
}
function currentFlows(){ return Object.keys(flowObjs).filter(id=>flowObjs[id].group.visible); }
function renderLegend(){
  const on = currentFlows(); const lg = document.getElementById('legend');
  if(!on.length){ lg.hidden = true; return; }
  lg.hidden = false; lg.innerHTML = on.map(id=>`<div><i style="background:${flowObjs[id].data.color}"></i>${esc(flowObjs[id].data.name)}</div>`).join('');
}
function renderFlowOptions(){
  const fo = document.getElementById('flowOpts'); fo.innerHTML = '';
  B.FLOWS.forEach(f=>{
    const l = document.createElement('label'); l.className='opt';
    l.innerHTML = `<input type="checkbox" id="f_${f.id}"><span class="sw" style="background:${f.color}"></span>${esc(f.name)}`;
    fo.appendChild(l);
    l.querySelector('input').addEventListener('change', e=>{ flowObjs[f.id].group.visible = e.target.checked; renderLegend(); });
  });
}
function applyXray(){
  const on = document.getElementById('oXray').checked;
  [boardMesh, ...boardGroup.userData.faces].forEach(m=>{ m.material.transparent = true; m.material.opacity = on? .18 : 1; m.material.depthWrite = !on; m.material.needsUpdate = true; });
}
function bindOptions(){
  document.getElementById('oCool').addEventListener('change',e=>{ coolGroup.visible = e.target.checked; });
  document.getElementById('oOled').addEventListener('change',e=>{ oledGroup.visible = e.target.checked; });
  document.getElementById('oExplode').addEventListener('change',e=>{ state.explodeTarget = e.target.checked?1:0; });
  document.getElementById('oXray').addEventListener('change',applyXray);
  document.getElementById('oPassive').addEventListener('change',applyPassives);
  document.getElementById('oTP').addEventListener('change',applyTP);
  document.getElementById('oColor').addEventListener('change',e=>{ state.colorBy = e.target.checked; applyHighlight(); });
  document.querySelectorAll('#views button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  document.getElementById('search').addEventListener('input',renderList);
  document.getElementById('mFree').addEventListener('click',()=>setMode('free'));
  document.getElementById('mTour').addEventListener('click',()=>setMode('tour'));
  document.getElementById('vBoard').addEventListener('click',()=>setPane('board'));
  document.getElementById('vDiag').addEventListener('click',()=>setPane('diag'));
  document.getElementById('tPrev').addEventListener('click',()=>goStep(state.tourIdx-1));
  document.getElementById('tNext').addEventListener('click',()=>{ if(state.tourIdx>=B.TOUR.length-1) setMode('free'); else goStep(state.tourIdx+1); });
  window.addEventListener('hashchange',()=>{ const id = location.hash.slice(1); if(BOARDS[id] && id!==B.id) setBoard(id); });
  window.addEventListener('keydown',e=>{
    if(state.mode!=='tour' || e.target.tagName==='INPUT') return;
    if(e.key==='ArrowRight') document.getElementById('tNext').click();
    if(e.key==='ArrowLeft') goStep(state.tourIdx-1);
    if(e.key==='Escape') setMode('free');
  });
}

/* boards */
function renderHeader(){
  document.getElementById('brandH1').innerHTML = B.h1;
  document.getElementById('brandSub').textContent = B.sub;
  document.title = B.title+' Explorer';
  document.getElementById('stats').innerHTML = B.stats.map(([k,v,t])=>`<span>${k} <b>${v}</b>${t?' '+t:''}</span>`).join('') + `<span>Parts <b id="partCount">–</b></span>`;
  document.querySelectorAll('#boards button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.board===B.id));
  // keep the active tab visible when the switch scrolls (narrow screens)
  const row = document.getElementById('boards'), on = row.querySelector('[aria-pressed="true"]');
  if(on && row.scrollWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth)/2;
  document.getElementById('oOledRow').hidden = !B.oled;
}
function renderBoardSwitch(){
  const el = document.getElementById('boards');
  el.innerHTML = Object.values(BOARDS).map(b=>`<button data-board="${b.id}" aria-pressed="false" title="${esc(b.title)}">${esc(b.tab)}</button>`).join('');
  el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setBoard(b.dataset.board)));
}
// Show a board: rebuild the 3D scene and every board-dependent panel. Display options carry over.
function setBoard(id){
  B = BOARDS[id] || Object.values(BOARDS)[0];
  if(location.hash.slice(1)!==B.id) history.replaceState(null, '', '#'+B.id);
  state.mode = 'free'; state.selected = null; state.highlight = null; state.explodeTarget = state.explode = 0;
  document.getElementById('oExplode').checked = false; document.getElementById('oCool').checked = false;
  document.getElementById('search').value = '';
  buildScene(); buildLabels();
  applyPassives(); applyTP(); applyXray();
  oledGroup.visible = !!B.oled && document.getElementById('oOled').checked;
  renderHeader(); renderFlowOptions(); renderLegend();
  const d = document.getElementById('diagram'); d.innerHTML = ''; delete d.dataset.built;
  setMode('free'); renderList();
  setView('iso', true);
}

/* modes */
function setMode(m){
  state.mode = m;
  document.getElementById('mFree').setAttribute('aria-pressed', m==='free');
  document.getElementById('mTour').setAttribute('aria-pressed', m==='tour');
  document.getElementById('tour').hidden = m!=='tour';
  document.getElementById('hint').hidden = m==='tour';
  setPane('board');
  if(m==='tour'){ goStep(0); }
  else { state.highlight = null; applyFlows([]); select(state.selected); }
}
function goStep(i){
  const TOUR = B.TOUR;
  i = Math.max(0, Math.min(TOUR.length-1, i)); state.tourIdx = i;
  const s = TOUR[i];
  document.getElementById('tStep').textContent = `STEP ${i+1} / ${TOUR.length}`;
  document.getElementById('tTitle').textContent = s.t;
  document.getElementById('tBody').innerHTML = s.p.map(t=>`<p>${esc(t)}</p>`).join('');
  const dots = document.getElementById('tDots'); dots.innerHTML='';
  TOUR.forEach((_,k)=>{ const b=document.createElement('button'); b.setAttribute('aria-label','Go to step '+(k+1)); b.setAttribute('aria-current',k===i); b.onclick=()=>goStep(k); dots.appendChild(b); });
  document.getElementById('tPrev').disabled = i===0;
  document.getElementById('tNext').textContent = i===TOUR.length-1 ? 'Finish' : 'Next';
  // scene state
  const cool = !!s.cool;
  state.explodeTarget = s.explode ? 1 : 0; document.getElementById('oExplode').checked = !!s.explode;
  coolGroup.visible = cool; document.getElementById('oCool').checked = cool;
  if(s.refs.some(r=>objs[r] && objs[r].isPassive)){ document.getElementById('oPassive').checked=true; applyPassives(); }
  state.highlight = s.refs.length ? s.refs.slice() : null;
  if(cool) state.highlight = s.refs.concat(B.COOLERS.map(c=>c.ref));
  state.selected = s.refs[0] || null;
  applyFlows(s.flows);
  applyHighlight(); renderInspector();
  if(s.side==='iso' && !s.refs.length) setView('iso'); else if(cool) frameCooler(); else frameRefs(s.refs, s.side);
}
// three-quarter view of the (exploded) cooler stack, scaled to its size
function frameCooler(){
  const c = B.COOLERS[0], [X,Z] = toWorld(c.x,c.y), k = Math.min(1.6, Math.max(1, c.size/40));
  const t = new THREE.Vector3(X-4, 20, Z-3);
  flyTo(t.clone().add(new THREE.Vector3(-111,115,161).multiplyScalar(k)), t);
}

/* block diagram */
function setPane(p){
  document.getElementById('vBoard').setAttribute('aria-pressed', p==='board');
  document.getElementById('vDiag').setAttribute('aria-pressed', p==='diag');
  const d = document.getElementById('diagram'); d.hidden = p!=='diag';
  if(p==='diag' && !d.dataset.built){ d.innerHTML = diagramSVG(); d.dataset.built='1';
    d.querySelectorAll('.blk').forEach(b=>{
      const open = ()=>{ setPane('board'); select(b.dataset.ref,{fly:true}); };
      b.addEventListener('click',open);
      b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } });
    }); }
}
function diagramSVG(){
  const D = B.diagram;
  const Bk = ([ref,x,y,w,h,title,sub,c])=>`<g class="blk" data-ref="${ref}" tabindex="0" role="button" aria-label="${title}: ${sub}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" style="stroke:${flowColor(c)}"/><text x="${x+12}" y="${y+22}" font-weight="600">${title}</text><text class="sub" x="${x+12}" y="${y+40}">${sub}</text></g>`;
  const W = ([d,c,label,lx,ly,dash])=>{ const col = flowColor(c); return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" ${dash?'stroke-dasharray="5 4"':''} marker-end="url(#ar${col.slice(1)})"/>${label?`<text class="wl" x="${lx}" y="${ly}" fill="${col}">${label}</text>`:''}`; };
  const cols = [...new Set([...D.blocks.map(b=>b[7]), ...D.wires.map(w=>w[1])].map(flowColor))];
  return `<svg viewBox="0 0 1100 640" role="img" aria-label="${esc(B.title)} block diagram">
  <defs>${cols.map(c=>`<marker id="ar${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>
  ${D.caps.map(([t,x])=>`<text class="cap" x="${x}" y="28">${t}</text>`).join('')}
  ${D.blocks.map(Bk).join('\n  ')}
  ${D.wires.map(W).join('\n  ')}
  ${(D.notes||[]).map(([t,x,y,c])=>`<text class="wl" x="${x}" y="${y}" fill="${flowColor(c)}">${t}</text>`).join('')}
  <text class="sub" x="20" y="620">Click any block to jump to that part on the 3D board.</text>
  </svg>`;
}

/* boot */
function boot(){
  if(!window.THREE || !THREE.OrbitControls){ document.getElementById('loading').textContent='Could not load the 3D engine. Check your connection and reload.'; return; }
  try{
    init(); renderBoardSwitch(); bindOptions(); setBoard(location.hash.slice(1));
    document.getElementById('loading').remove(); // only once everything is built, so errors stay visible
  }catch(err){ console.error(err); const l=document.getElementById('loading'); if(l) l.textContent='Error: '+err.message; }
}
if(document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();

/* Bitaxe Gamma Explorer: scene, interaction, UI, guided tour. Depends on js/data.js and three.js. */
"use strict";
/* ====================================================================
   THREE.JS SCENE
   ==================================================================== */
const stage = document.getElementById('stage');
const cv = document.getElementById('cv');
let renderer, scene, camera, controls, raycaster, pointer;
const objs = {};            // ref -> {group, meshes:[], data, side, base:{y}}
const pickables = [];
let boardMesh, boardGroup, coolGroup, oledGroup, tpGroup, flowGroup;
const flowObjs = {};
let state = {selected:null, mode:"free", tourIdx:0, explode:0, explodeTarget:0, highlight:null, colorBy:false};

function toWorld(x,y){ return [-(x-EDGE.x0-BW/2), (y-EDGE.y0-BH/2)]; } // [X, Z] — mirrored so top view matches the physical board
const SURF_T = BT/2, SURF_B = -BT/2;
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
  boardGroup = new THREE.Group(); scene.add(boardGroup);
  buildBoard(); buildParts(); buildPassives(); buildTestPoints(); buildCooling(); buildOled(); buildFlows();

  raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerdown', e=>{ downAt=[e.clientX,e.clientY]; });
  cv.addEventListener('pointerup', onClick);
  cv.addEventListener('pointerleave', ()=>{ tip.hidden = true; hoverRef=null; });
  new ResizeObserver(resize).observe(stage); resize();
  document.getElementById('loading').remove();
  setView('iso', true);
  animate();
}

/* ---------------- board ---------------- */
function boardTexture(side){
  const s = 12, c = document.createElement('canvas'); c.width = Math.round(BW*s); c.height = Math.round(BH*s);
  const g = c.getContext('2d');
  g.fillStyle = '#123d2a'; g.fillRect(0,0,c.width,c.height);
  // subtle copper pour texture (decorative, seeded so it is stable between loads)
  const rand = rng(601);
  g.globalAlpha = .18; g.fillStyle = '#1f6a45';
  for(let i=0;i<14;i++){ g.fillRect(rand()*c.width, rand()*c.height, 30+rand()*180, 20+rand()*120); }
  g.globalAlpha = 1;
  // pixel coords: top side is mirrored in X
  const P = (x,y)=>[ side==='top' ? (EDGE.x1-x)*s : (x-EDGE.x0)*s, (y-EDGE.y0)*s ];
  // traces (stylised, from real endpoints)
  g.strokeStyle = 'rgba(70,160,110,.55)'; g.lineWidth = 2.2; g.lineCap='round';
  const tr = (pts)=>{ g.beginPath(); pts.forEach((p,i)=>{ const [a,b]=P(p[0],p[1]); i?g.lineTo(a,b):g.moveTo(a,b); }); g.stroke(); };
  if(side==='top'){
    // ASIC fan-out like the render
    for(let i=0;i<15;i++){ const yy=113+i*0.5; tr([[101,yy],[96-i*0.3,yy-4+i*.2],[92,108+i*1.2]]); tr([[110,yy],[115+i*.3,yy-4+i*.2],[120,108+i*1.2]]); }
    tr([[117,80],[117,96],[118,100]]); tr([[112,72],[100,80],[93,90]]);
    // heatsink keep-out square
    g.strokeStyle='rgba(235,240,236,.85)'; g.lineWidth=2;
    const [hx0,hy0]=P(HS_CENTER[0]+20.7,HS_CENTER[1]-20.7), [hx1,hy1]=P(HS_CENTER[0]-20.7,HS_CENTER[1]+20.7);
    g.strokeRect(Math.min(hx0,hx1),Math.min(hy0,hy1),Math.abs(hx1-hx0),Math.abs(hy1-hy0));
    // logo
    g.fillStyle='#e6c25a'; g.font=`700 ${9*s}px "Chakra Petch", serif`; g.textAlign='center';
    const [lx,ly]=P(105.13,92); g.fillText('Bitaxe', lx, ly);
    g.font=`600 ${3.2*s}px "IBM Plex Mono", monospace`; g.fillStyle='#eef2ef'; g.fillText('Gamma · 601', lx, ly+4.6*s);
    // silkscreen
    g.fillStyle='#eef2ef'; g.font=`500 ${2.2*s}px "IBM Plex Mono", monospace`;
    let [a,b]=P(130.1,108.4); g.fillText('RESET',a,b);
    [a,b]=P(130,117.1); g.fillText('BOOT',a,b);
    [a,b]=P(84.6,75); g.fillText('5VDC ⊖-C-⊕',a,b);
    [a,b]=P(89.6,139.5); g.fillText('PWM TAC 5V GND',a,b);
    [a,b]=P(87.2,54.4); g.fillText('GND VCC SCL SDA',a,b);
  } else {
    tr([[93.6,77.6],[100.3,85.3]]); tr([[100.3,85.3],[108.9,86],[108.9,81],[108.9,91]]); tr([[108.9,91],[106,104.8]]);
    tr([[112.6,63.4],[117,70]]); tr([[118.3,100.1],[111,99.6],[110,96.6]]); tr([[93.9,130],[96.3,123.9]]); tr([[93.9,130],[90.3,140.4]]);
    tr([[111,130.2],[114.7,125.2]]); tr([[102.5,130.5],[106.4,134.2]]);
    g.fillStyle='#eef2ef'; g.font=`500 ${2.2*s}px "IBM Plex Mono", monospace`; g.textAlign='center';
    let [a,b]=P(105.4,145.5); g.fillText('bitaxeGamma · open source · bitaxe.org',a,b);
    [a,b]=P(99.2,55.2); g.fillText('5V GND 39 40 41 42',a,b);
  }
  // vias: decorative stitching, not from KiCad. A fresh seeded stream per call gives both faces the same
  // through-hole positions; vias that would land in or beside a mounting hole are skipped.
  g.fillStyle='rgba(216,179,90,.8)';
  const vr = rng(1370);
  for(let i=0;i<220;i++){ const x = EDGE.x0+3+vr()*(BW-6), y = EDGE.y0+3+vr()*(BH-6);
    if(HOLES.some(([,hx,hy,d])=>Math.hypot(x-hx,y-hy) < d/2+2.2)) continue;
    const [a,b]=P(x,y); g.beginPath(); g.arc(a,b,3,0,Math.PI*2); g.fill(); }
  // thermal via array under ASIC (real board has a dense via field)
  for(let i=-2;i<=2;i++) for(let j=-2;j<=2;j++){ const [a,b]=P(105.6+i*1.4,116.5+j*1.4); g.beginPath(); g.arc(a,b,5,0,Math.PI*2); g.fill(); }
  // ASIC pads gold on both sides
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.encoding = THREE.sRGBEncoding; return t;
}
function roundedRectShape(w,h,r){
  const s = new THREE.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s;
}
function buildBoard(){
  const shape = roundedRectShape(BW,BH,1.2);
  HOLES.forEach(([ref,x,y,d])=>{ const [X,Z]=toWorld(x,y); const h=new THREE.Path(); h.absarc(X,-Z,d/2,0,Math.PI*2,true); shape.holes.push(h); });
  const geo = new THREE.ExtrudeGeometry(shape,{depth:BT, bevelEnabled:false, curveSegments:24});
  geo.rotateX(-Math.PI/2); geo.translate(0,-BT/2,0);
  const edgeMat = new THREE.MeshStandardMaterial({color:0x2c4f3a, roughness:.8});
  boardMesh = new THREE.Mesh(geo, edgeMat); boardMesh.receiveShadow = true; boardGroup.add(boardMesh);
  // printed faces
  const faceShape = (side)=>{ const sh = roundedRectShape(BW,BH,1.2);
    HOLES.forEach(([ref,x,y,d])=>{ const [X,Z]=toWorld(x,y); const h=new THREE.Path(); h.absarc(X, side==='top'?-Z:Z, d/2,0,Math.PI*2,true); sh.holes.push(h); }); return sh; };
  const mk = (side)=>{
    const m = new THREE.MeshStandardMaterial({map:boardTexture(side), roughness:.45, metalness:.05});
    const f = new THREE.Mesh(new THREE.ShapeGeometry(faceShape(side),24), m);
    f.rotation.x = side==='top' ? -Math.PI/2 : Math.PI/2;
    f.position.y = side==='top' ? SURF_T+0.01 : SURF_B-0.01;
    if(side==='bottom') f.rotation.z = Math.PI; // keep text readable from below
    if(side==='bottom') f.scale.x = 1;
    // UV: ShapeGeometry UVs are in shape units; remap 0..1
    const uv = f.geometry.attributes.uv, pos = f.geometry.attributes.position;
    for(let i=0;i<uv.count;i++){ uv.setXY(i, (pos.getX(i)+BW/2)/BW, (pos.getY(i)+BH/2)/BH); }
    f.receiveShadow = true; boardGroup.add(f); return f;
  };
  boardGroup.userData.faces = [mk('top'), mk('bottom')];
  boardGroup.userData.faces[1].rotation.set(Math.PI/2,0,0);
  // flip bottom face mapping so it matches KiCad (non-mirrored) when viewed from below
  { const f = boardGroup.userData.faces[1]; const uv=f.geometry.attributes.uv, pos=f.geometry.attributes.position;
    for(let i=0;i<uv.count;i++){ uv.setXY(i, 1-(pos.getX(i)+BW/2)/BW, 1-(pos.getY(i)+BH/2)/BH); } uv.needsUpdate = true; }
  // fix top face orientation: shape Y maps to -Z after rotation; we want texture row 0 at Z=-BH/2 (KiCad y0)
  { const f = boardGroup.userData.faces[0]; const uv=f.geometry.attributes.uv, pos=f.geometry.attributes.position;
    for(let i=0;i<uv.count;i++){ uv.setXY(i, (pos.getX(i)+BW/2)/BW, (pos.getY(i)+BH/2)/BH); } uv.needsUpdate = true; }
  // plated holes rings
  HOLES.forEach(([ref,x,y,d,kind])=>{
    const [X,Z]=toWorld(x,y);
    if(kind==='pad'){
      [SURF_T+0.02,SURF_B-0.02].forEach(yy=>{ const r=new THREE.Mesh(new THREE.RingGeometry(d/2,d/2+1.6,32), MATS.pads); r.rotation.x=-Math.PI/2; r.position.set(X,yy,Z); boardGroup.add(r); });
    }
    const id = registerSimple(ref, kind==='pad'?'Corner mounting hole':'Heatsink mounting hole', 'mech', 'top', x,y, null,
      kind==='pad' ? "Plated 3 mm mounting hole tied to ground. Used to mount the board on a stand." :
      "3.5 mm hole, one of four on a ~41 mm square around the ASIC. Screws or springs through these clamp the 40 × 40 mm heatsink onto the chip.");
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(d/2+0.05,d/2+0.05,BT+0.1,24,1,true), new THREE.MeshStandardMaterial({color:0xb8a060,metalness:.8,roughness:.35,side:THREE.DoubleSide}));
    ring.position.set(X,0,Z); id.group.add(ring); id.meshes.push(ring); pickables.push(ring); ring.userData.ref=ref;
  });
}

/* ---------------- parts ---------------- */
function addObj(ref, data, side){
  const g = new THREE.Group(); boardGroup.add(g);
  objs[ref] = {group:g, meshes:[], data, side, labelEl:null};
  return objs[ref];
}
function registerSimple(ref,name,group,side,x,y,dims,desc){
  const data = {ref,name,group,side,x,y,what:desc, simple:true};
  return addObj(ref,data,side);
}
function rotDims(d,rot){ const r = ((rot%360)+360)%360; return (r===90||r===270) ? [d[1],d[0],d[2]] : [d[0],d[1],d[2]]; }
// Direction a part's one-sided feature (antenna, plug opening) points. p.face is a KiCad board direction
// ('+x','-x','+y','-y'); world X is mirrored (see toWorld), so KiCad ±x becomes ∓X in mesh space.
function faceOf(p){
  const f = p.face || '-x', isX = f[1]==='x', s = f[0]==='+' ? 1 : -1;
  return {axis: isX ? 'x' : 'z', sign: isX ? -s : s};
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
      const die = new THREE.Mesh(new THREE.BoxGeometry(w-1.6,0.75,l-1.6), topMatWithLabel(MATS.asic,"BM1370",{bg:'#3a3d44',fg:'#c8ccd4',grain:true}));
      die.position.y = 0.25+0.37; die.castShadow=true; grp.add(die);
      // side pads
      for(let i=0;i<15;i++){ const z=-3.514+i*0.502; add(new THREE.BoxGeometry(0.7,0.12,0.22),MATS.pads,0.06, w/2+0.15, z); add(new THREE.BoxGeometry(0.7,0.12,0.22),MATS.pads,0.06,-w/2-0.15, z); }
      break; }
    case 'inductor': {
      add(new THREE.BoxGeometry(w,h,l), MATS.inductor, h/2);
      const top = add(new THREE.BoxGeometry(w-0.6,0.05,l-0.6), new THREE.MeshStandardMaterial({map:makeLabelTexture("R30",w,l,{bg:'#2e2e30',fg:'#9b9ba0'})}), h+0.02);
      add(new THREE.BoxGeometry(1.6,1.2,l*0.8),MATS.term,0.6,-w/2+0.8); add(new THREE.BoxGeometry(1.6,1.2,l*0.8),MATS.term,0.6,w/2-0.8);
      break; }
    case 'jack': {
      add(new THREE.BoxGeometry(w,h,l), MATS.jack, h/2);
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
      const n = Math.round(Math.max(w,l)/2.54);
      for(let i=0;i<n;i++){ const off=-((n-1)*2.54)/2+i*2.54; const pin=new THREE.BoxGeometry(0.64,h,0.64);
        if(w>l) add(pin,MATS.pads,h/2,off,0); else add(pin,MATS.pads,h/2,0,off); }
      break; }
    case 'fanconn': {
      add(new THREE.BoxGeometry(w,h,l), MATS.fanconn, h/2);
      const n=4; for(let i=0;i<n;i++){ const off=-((n-1)*(w>8?2.54:1))/2+i*(w>8?2.54:1); add(new THREE.BoxGeometry(0.6,h*0.8,0.6),MATS.pads,h*0.55,off,0); }
      break; }
    case 'button': {
      add(new THREE.BoxGeometry(w,1,l), MATS.button, 0.5);
      add(new THREE.CylinderGeometry(0.9,0.9,0.9,20), new THREE.MeshStandardMaterial({color:0x111111}), 1.4);
      break; }
    case 'pads': {
      if(p.ref==='J2'){ for(let i=0;i<3;i++) for(let j=0;j<2;j++) add(new THREE.CylinderGeometry(0.4,0.4,0.06,16),MATS.pads,0.03,-1.27+i*1.27,-0.635+j*1.27); }
      else add(new THREE.BoxGeometry(w,0.06,l),MATS.pads,0.03);
      break; }
    case 'metal': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w,h,l), MATS.metal.clone()); body.position.y=h/2; body.castShadow=true; grp.add(body);
      if(p.ref==='J5'){ const [mw,ml] = xz(0.4,6.2), [mx,mz] = xz(F.sign*(len/2+0.01),0);
        const mouth=new THREE.Mesh(new THREE.BoxGeometry(mw,1.6,ml), new THREE.MeshStandardMaterial({color:0x050505})); mouth.position.set(mx,h/2,mz); grp.add(mouth); }
      break; }
    default: { // ic
      const mats = topMatWithLabel(MATS.ic, p.mark||p.ref, {bg:'#1d1f22', fg:'#8e9499'});
      const b = new THREE.Mesh(new THREE.BoxGeometry(w,h,l), mats); b.position.y=h/2; b.castShadow=true; grp.add(b);
      // leads
      const isLong = Math.max(w,l);
      if(!p.pkg.includes('LQFN')){
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
  inner.traverse(m=>{ if(m.isMesh){ o.meshes.push(m); pickables.push(m); m.userData.ref=o.data.ref; } });
}

function buildParts(){
  PARTS.forEach(p=>{
    const o = addObj(p.ref, p, p.side);
    placeGroup(o, p.x, p.y, p.side, partMesh(p));
  });
}
function buildPassives(){
  PASSIVES.forEach(([ref,val,size,x,y,rot,nets,group,role])=>{
    const isR = ref[0]==='R';
    const dnp = val==='DNP';
    const data = {ref, name: (isR?'Resistor ':'Capacitor ')+val, part: (isR?'Resistor ':'Capacitor ')+val+' · '+size, pkg:size+' SMD', group:'passive', subgroup:group, side:'bottom', x,y, rot, what:role, netsStr:nets, passive:true, dnp};
    const o = addObj(ref,data,'bottom');
    const d = rotDims(PKG[size], rot);
    const grp = new THREE.Group();
    if(!dnp){
      const body = new THREE.Mesh(new THREE.BoxGeometry(d[0]*(d[0]>d[1]?0.7:1), d[2], d[1]*(d[1]>d[0]?0.7:1)), (isR?MATS.res:MATS.cap).clone());
      body.position.y = d[2]/2; body.castShadow = true; grp.add(body);
      const along = d[0]>=d[1];
      [-1,1].forEach(s=>{ const t=new THREE.Mesh(new THREE.BoxGeometry(along?d[0]*0.16:d[0], d[2]*1.02, along?d[1]:d[1]*0.16), MATS.term.clone());
        t.position.set(along?s*d[0]*0.42:0, d[2]/2, along?0:s*d[1]*0.42); grp.add(t); });
    } else {
      [-1,1].forEach(s=>{ const along=d[0]>=d[1]; const t=new THREE.Mesh(new THREE.BoxGeometry(along?0.4:d[0],0.04,along?d[1]:0.4), MATS.pads.clone()); t.position.set(along?s*d[0]*0.35:0,0.02,along?0:s*d[1]*0.35); grp.add(t); });
    }
    placeGroup(o, x, y, 'bottom', grp);
    o.isPassive = true;
  });
}
function buildTestPoints(){
  tpGroup = [];
  TPS.forEach(([ref,x,y,net])=>{
    const data = {ref, name:'Test point · '+net, part:'1.5 mm test pad', pkg:'TestPoint_Pad_D1.5mm', group:'test', side:'bottom', x,y, what:`Bare copper pad on the ${net} net. Touch a multimeter or scope probe here to measure the signal or rail while debugging.`, netsStr:net, tp:true};
    const o = addObj(ref,data,'bottom');
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,0.08,20), MATS.pads.clone()); m.position.y=0.04; grp.add(m);
    placeGroup(o,x,y,'bottom',grp); o.group.visible = false; o.isTP = true; tpGroup.push(o);
  });
}

/* ---------------- cooling ---------------- */
function buildCooling(){
  coolGroup = new THREE.Group(); boardGroup.add(coolGroup);
  const [X,Z] = toWorld(HS_CENTER[0], HS_CENTER[1]);
  const [aX,aZ] = toWorld(105.611,116.546);
  coolGroup.position.set(X, SURF_T, Z);
  const al = new THREE.MeshStandardMaterial({color:0xb9bec3, metalness:.85, roughness:.35});
  const hs = new THREE.Group(); coolGroup.add(hs);
  const base = new THREE.Mesh(new THREE.BoxGeometry(40,3,40), al); base.position.y = 1.0+1.5; base.castShadow=true; hs.add(base);
  for(let i=0;i<13;i++){ const fin=new THREE.Mesh(new THREE.BoxGeometry(1.1,8,40), al); fin.position.set(-18.5+i*3.08, 1+3+4, 0); fin.castShadow=true; hs.add(fin); }
  const fan = new THREE.Group(); fan.position.y = 1+3+8; coolGroup.add(fan);
  const frameMat = new THREE.MeshStandardMaterial({color:0x8a8172, roughness:.8});
  const frame = new THREE.Shape(); frame.moveTo(-20,-20); frame.lineTo(20,-20); frame.lineTo(20,20); frame.lineTo(-20,20); frame.lineTo(-20,-20);
  const hole = new THREE.Path(); hole.absarc(0,0,18.6,0,Math.PI*2,true); frame.holes.push(hole);
  const fg = new THREE.ExtrudeGeometry(frame,{depth:10,bevelEnabled:false,curveSegments:40}); fg.rotateX(-Math.PI/2);
  const fm = new THREE.Mesh(fg, frameMat); fm.castShadow=true; fan.add(fm);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(7,7,8,32), new THREE.MeshStandardMaterial({color:0x5a3d31,roughness:.7})); hub.position.y=5; fan.add(hub);
  const blades = new THREE.Group(); blades.position.y = 5; fan.add(blades); coolGroup.userData.blades = blades;
  const bm = new THREE.MeshStandardMaterial({color:0x6a4638, roughness:.65, side:THREE.DoubleSide});
  for(let i=0;i<9;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(11,0.6,5.5), bm); b.position.set(Math.cos(i/9*Math.PI*2)*12.5,0,Math.sin(i/9*Math.PI*2)*12.5); b.rotation.y=-i/9*Math.PI*2; b.rotation.x=.45; blades.add(b); }
  coolGroup.userData.hs = hs; coolGroup.userData.fan = fan;
  coolGroup.visible = false;
  const o = {group:coolGroup, meshes:[], data:{ref:'HS1', name:'Heatsink + 40 mm fan', group:'thermal', side:'top', simple:true, what:"A 40 × 40 mm aluminium heatsink sits directly on the ASIC with thermal paste and is clamped through the four 3.5 mm holes. A 40 mm 5 V 4-pin PWM fan mounts on top. The project suggests a good paste such as Thermal Grizzly Kryonaut and a quieter fan such as the Noctua NF-A4x10 5V PWM.", specs:[["Heatsink","40 × 40 mm aluminium"],["Fan","40 mm, 5 V, 4-pin PWM"],["Interface","Thermal paste on the chip"]]}, side:'top'};
  coolGroup.traverse(m=>{ if(m.isMesh){ o.meshes.push(m); pickables.push(m); m.userData.ref='HS1'; } });
  objs['HS1'] = o; o.baseY = SURF_T;
}
function buildOled(){
  oledGroup = new THREE.Group(); boardGroup.add(oledGroup);
  const [hx,hz] = toWorld(87.205,50.292);
  oledGroup.position.set(hx-15.5, SURF_T+8.5, hz+5.6);
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(38,1.2,12), new THREE.MeshStandardMaterial({color:0x1d4fa8,roughness:.6})); pcb.castShadow=true; oledGroup.add(pcb);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(30,1.4,11.4), [0,0,0,0,0,0].map((_,i)=> i===2 ? new THREE.MeshStandardMaterial({map:makeLabelTexture('',30,11.4,{bg:'#05070a',draw:(g,c)=>{g.fillStyle='#57b7ff';g.font=`500 ${c.height*.17}px "IBM Plex Mono",monospace`;['Gh: 1206.1  J/Th: 14','A/R: 22985/59','UT: 2d 11h 53m','BD: 60.4M'].forEach((t,i)=>g.fillText(t,c.width*.06,c.height*(.24+i*.21)));}}),emissive:0x0d2a44,roughness:.2}) : new THREE.MeshStandardMaterial({color:0x111418,roughness:.2})));
  glass.position.set(-2.5,1.2,0); oledGroup.add(glass);
  const o = {group:oledGroup, meshes:[], data:{ref:'DSP1', name:'0.91" OLED module', group:'io', side:'top', simple:true, part:'SSD1306 128 × 32 I2C OLED', what:"The plug-in status display. It sits on the J3 header and shows hashrate, efficiency, shares, uptime and best difficulty. The firmware drives it at I2C address 0x3C. The values shown here are sample readings.", specs:[["Controller","SSD1306"],["Resolution","128 × 32"],["Bus","I2C 0x3C (3.3 V)"]]}, side:'top'};
  oledGroup.traverse(m=>{ if(m.isMesh){ o.meshes.push(m); pickables.push(m); m.userData.ref='DSP1'; } });
  objs['DSP1']=o; o.baseY = oledGroup.position.y;
}

/* ---------------- flows ---------------- */
function flowCurve(pts){
  const v = pts.map(([x,y,s])=>{ const [X,Z]=toWorld(x,y); return new THREE.Vector3(X, s==='t'? SURF_T+2.2 : SURF_B-2.2, Z); });
  return new THREE.CatmullRomCurve3(v, false, 'centripetal', .5);
}
function buildFlows(){
  flowGroup = new THREE.Group(); boardGroup.add(flowGroup);
  FLOWS.forEach(f=>{
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
let hoverRef = null, downAt = null;
function pick(e){
  const r = cv.getBoundingClientRect();
  pointer.x = ((e.clientX-r.left)/r.width)*2-1; pointer.y = -((e.clientY-r.top)/r.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hits = raycaster.intersectObjects(pickables.filter(m=>isVisible(m)), false);
  return hits.length ? hits[0].object.userData.ref : null;
}
function isVisible(m){ let o=m; while(o){ if(!o.visible) return false; o=o.parent; } return true; }
function onMove(e){
  const ref = pick(e);
  hoverRef = ref;
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
  if(moved>5) return;
  const ref = pick(e);
  if(ref) select(ref, {fly:true}); else if(state.mode==='free') select(null);
}

/* camera tween */
let tween = null;
function flyTo(pos, target, ms=900){
  tween = {p0:camera.position.clone(), t0:controls.target.clone(), p1:pos, t1:target, start:performance.now(), ms};
}
function viewPreset(name){
  const s = 1;
  switch(name){
    case 'top': return [new THREE.Vector3(0,175*s,8), new THREE.Vector3(0,0,0)];
    case 'bottom': return [new THREE.Vector3(0,-175*s,8), new THREE.Vector3(0,0,0)];
    case 'edge': return [new THREE.Vector3(140,8,40), new THREE.Vector3(0,0,10)];
    default: return [new THREE.Vector3(90,115,125), new THREE.Vector3(0,0,8)];
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
        mt.transparent = !on || mt.userData.orig.transparent; mt.opacity = on ? mt.userData.orig.opacity : .12;
        mt.depthWrite = on;
        if(mt.emissive){ if(ref===sel) mt.emissive.setHex(0x5a4410); else if(set && isSel) mt.emissive.setHex(0x1a1405); else mt.emissive.copy(mt.userData.orig.emissive); }
        if(mt.color && mt.userData.orig.color){
          if(state.colorBy && o.data.group){
            const gcol = new THREE.Color(css(GROUPS[o.data.group]?.color || '--c-mech'));
            mt.color.copy(mt.userData.orig.color).lerp(gcol, .65);
          } else mt.color.copy(mt.userData.orig.color);
        }
        mt.needsUpdate = true;
      });
    });
  });
}

/* ====================================================================
   LABELS (projected HTML)
   ==================================================================== */
const labelsEl = document.getElementById('labels');
const LABELED = ["U8","U4","U2","L1","U9","U10","U7","U3","U5","U6","J1","J5","J3","J4","J6","SW1","SW2","J2","HS1","DSP1"];
function buildLabels(){
  LABELED.forEach(ref=>{
    const o = objs[ref]; if(!o) return;
    const el = document.createElement('div'); el.className='tag';
    el.innerHTML = `<b>${ref}</b> ${esc(short(o.data))}`;
    el.addEventListener('click',()=>select(ref,{fly:true}));
    labelsEl.appendChild(el); o.labelEl = el;
  });
}
function short(d){ const m = {U8:"BM1370",U4:"ESP32-S3",U2:"TPS546D24A",L1:"300 nH",U9:"Level shift",U10:"EMC2101",U7:"25 MHz",U3:"3V3 LDO",U5:"1V2 LDO",U6:"0V8 LDO",J1:"5 V in",J5:"USB-C",J3:"OLED hdr",J4:"Accessory",J6:"Fan",SW1:"Reset",SW2:"Boot",J2:"Tag-Connect",HS1:"Cooler",DSP1:"OLED"}; return m[d.ref]||d.name; }
const _v = new THREE.Vector3();
function updateLabels(){
  const show = document.getElementById('oLabels').checked;
  const r = stage.getBoundingClientRect();
  const camUp = camera.position.y - controls.target.y;
  LABELED.forEach(ref=>{
    const o = objs[ref]; if(!o||!o.labelEl) return;
    let vis = show && isVisible(o.group);
    if(vis){
      const box = new THREE.Box3().setFromObject(o.group);
      if(o.side==='top'){ _v.set((box.min.x+box.max.x)/2, box.max.y+1, (box.min.z+box.max.z)/2); vis = camera.position.y > -5 || ref==='HS1'; }
      else { _v.set((box.min.x+box.max.x)/2, box.min.y-1, (box.min.z+box.max.z)/2); vis = camera.position.y < 5; }
      if(state.highlight && !state.highlight.includes(ref) && ref!==state.selected) vis=false;
      if(coolGroup.visible && ['U8'].includes(ref) && camera.position.y>0) vis = false;
    }
    if(!vis){ o.labelEl.style.display='none'; return; }
    _v.project(camera);
    if(_v.z>1){ o.labelEl.style.display='none'; return; }
    o.labelEl.style.display='block';
    o.labelEl.style.left = ((_v.x+1)/2*r.width)+'px';
    o.labelEl.style.top = ((-_v.y+1)/2*r.height - 8)+'px';
    o.labelEl.style.borderColor = ref===state.selected ? css('--gold') : '';
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
    if(o.baseY===undefined || o.data.ref==='HS1' || o.data.ref==='DSP1') return;
    const lift = (o.isPassive||o.isTP) ? 6 : 12;
    o.group.position.y = o.baseY + (o.side==='top'? 1 : -1) * ex * lift;
  });
  if(coolGroup){ coolGroup.position.y = SURF_T + ex*22; coolGroup.userData.fan.position.y = 12 + ex*18; if(coolGroup.visible) coolGroup.userData.blades.rotation.y += dt*9; }
  if(oledGroup){ oledGroup.position.y = SURF_T+8.5 + ex*14; }
  // flows
  Object.values(flowObjs).forEach(f=>{
    if(!f.group.visible) return;
    f.parts.forEach(s=>{ s.userData.t = (s.userData.t + dt*f.speed* (60/ s.userData.curve.getLength())) % 1; s.position.copy(s.userData.curve.getPointAt(s.userData.t)); });
  });
  renderer.render(scene,camera);
  updateLabels();
}
function resize(){
  const r = stage.getBoundingClientRect();
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
  document.getElementById('partCount').textContent = partCount();
}

function ensureVisibleFor(ref){
  const o = objs[ref]; if(!o) return;
  if(o.isPassive && !document.getElementById('oPassive').checked){ document.getElementById('oPassive').checked = true; applyPassives(); }
  if(o.isTP && !document.getElementById('oTP').checked){ document.getElementById('oTP').checked = true; applyTP(); }
  if(ref==='HS1' && !coolGroup.visible){ document.getElementById('oCool').checked = true; coolGroup.visible = true; }
  if(ref==='DSP1' && !oledGroup.visible){ document.getElementById('oOled').checked = true; oledGroup.visible = true; }
}
function select(ref, opts={}){
  state.selected = ref;
  if(ref){ ensureVisibleFor(ref); if(opts.fly){ const o=objs[ref]; frameRefs([ref], o.side==='bottom'?'bottom':'top'); } }
  if(state.mode==='free') state.highlight = null;
  applyHighlight();
  renderInspector();
  document.querySelectorAll('#list .item').forEach(b=>b.setAttribute('aria-current', b.dataset.ref===ref));
  const cur = document.querySelector(`#list .item[data-ref="${ref}"]`); if(cur && opts.fromList!==true) cur.scrollIntoView({block:'nearest'});
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
  if(d.how) h += `<h3>How it works on the Gamma</h3><p>${esc(d.how)}</p>`;
  if(d.specs && d.specs.length) h += `<h3>Key facts</h3><dl class="kv">${d.specs.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  if(d.nets) h += `<h3>Connected nets</h3><div class="nets">${d.nets.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`;
  if(d.netsStr && !d.nets) h += `<h3>Connected nets</h3><div class="nets">${d.netsStr.split('/').map(n=>`<span>${esc(n)}</span>`).join('')}</div>`;
  if(ref==='U8') h += asicExtras();
  if(d.note) h += `<p class="note">${esc(d.note)}</p>`;
  if(d.links) h += `<h3>Source</h3><div class="links">${d.links.map(([t,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join('')}</div>`;
  h += `<h3>Board position</h3><dl class="kv"><dt>KiCad X, Y</dt><dd>${(+d.x).toFixed(2)}, ${(+d.y).toFixed(2)} mm</dd>${d.rot!==undefined?`<dt>Rotation</dt><dd>${d.rot}°</dd>`:''}</dl>`;
  h += `<p style="margin-top:14px"><button class="btn" id="backOv">← Board overview</button></p>`;
  el.innerHTML = h;
  document.getElementById('backOv').onclick = ()=>select(null);
  if(ref==='U8') bindCalc();
  el.parentElement.scrollTop = 0;
}

function asicExtras(){
  const freqs = [400,490,525,550,600,625,690];
  return `<h3>Hashrate calculator</h3>
  <div class="calc">
    <label for="fq"><span>ASIC frequency</span><span id="fqv">525 MHz</span></label>
    <input type="range" id="fq" min="0" max="${freqs.length-1}" step="1" value="2" aria-label="Frequency">
    <div class="big" id="hr">1.071 TH/s</div>
    <small>hashrate ≈ frequency × 2040 small cores. PLL multiplier from the 25 MHz clock: <span id="pll">×21</span>. AxeOS presets: ${freqs.join(', ')} MHz.</small>
  </div>
  <h3>Pinout (from the KiCad footprint)</h3>
  <div class="pinout">${pinoutSVG()}</div>`;
}
function bindCalc(){
  const freqs = [400,490,525,550,600,625,690];
  const fq = document.getElementById('fq');
  const upd = ()=>{ const f = freqs[+fq.value]; document.getElementById('fqv').textContent = f+' MHz'; document.getElementById('hr').textContent = (f*2040/1e6).toFixed(3)+' TH/s'; document.getElementById('pll').textContent = '×'+(f/25).toFixed(1).replace(/\.0$/,''); };
  fq.addEventListener('input',upd); upd();
}
function pinoutSVG(){
  const colors = {tap:'var(--c-power)',gnd:'var(--c-passive)',ctl:'var(--c-control)',clk:'#e0e36a',strap:'var(--muted)',io:'#ffc46b',temp:'var(--c-thermal)',chain:'var(--c-io)'};
  const W=340, H=330, bx=120, bw=100, by=20, bh=290;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="BM1370 pinout">`;
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="var(--panel-2)" stroke="var(--line)"/>`;
  s += `<rect x="${bx+14}" y="${by+20}" width="${bw-28}" height="60" rx="3" fill="none" stroke="var(--c-power)" stroke-dasharray="3 3"/>`;
  s += `<text x="${bx+bw/2}" y="${by+46}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="var(--c-power)">31 · VDD</text><text x="${bx+bw/2}" y="${by+62}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--muted)">core power</text>`;
  s += `<rect x="${bx+14}" y="${by+92}" width="${bw-28}" height="170" rx="3" fill="none" stroke="var(--c-passive)" stroke-dasharray="3 3"/>`;
  s += `<text x="${bx+bw/2}" y="${by+176}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="var(--c-passive)">32 · VSS</text><text x="${bx+bw/2}" y="${by+192}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--muted)">ground / heat</text>`;
  PINS.forEach(([n,name,k])=>{
    const left = n<=15, i = left? n-1 : 30-n;
    const y = by+14+i*18.6;
    const x0 = left? bx-10 : bx+bw, col = colors[k];
    s += `<rect x="${x0}" y="${y-3}" width="10" height="6" fill="${col}"/>`;
    s += `<text x="${left? x0-4 : x0+14}" y="${y+3.5}" text-anchor="${left?'end':'start'}" font-family="IBM Plex Mono" font-size="10" fill="var(--fg)">${n} ${name}</text>`;
  });
  s += `</svg>`;
  s += `<p style="font-size:12px;color:var(--muted);margin-top:6px"><span style="color:var(--c-control)">■</span> control (CI/RO/reset/BI) · <span style="color:#e0e36a">■</span> clock · <span style="color:#ffc46b">■</span> I/O rails · <span style="color:var(--c-power)">■</span> domain taps · <span style="color:var(--c-thermal)">■</span> temp diode · <span style="color:var(--c-io)">■</span> chain outputs to the next chip (test points only on a single-chip board)</p>`;
  return s;
}

function overviewHTML(){
  return `<div class="overview">
  <div class="kick"><span class="chip" style="color:var(--gold)">Overview</span><span class="ref">bitaxeGamma · 5th major Bitaxe revision</span></div>
  <h2>An open-source, one-chip Bitcoin miner</h2>
  <p>The Gamma pairs a Bitmain BM1370 ASIC with an ESP32-S3 controller on a 4-layer, 1.6 mm board. The schematics, layout, BOM and firmware are all open source, so you can trace every part shown here back to the design files.</p>
  <div class="ov-grid">
    <div><b>≈1.07 TH/s</b><span>at the 525 MHz default</span></div>
    <div><b>5 V · &gt;4 A</b><span>DC input, ~20 W</span></div>
    <div><b>1.15 V</b><span>default core rail (VDD)</span></div>
    <div><b>${partCount()}</b><span>populated parts</span></div>
  </div>
  <h3>Subsystems</h3>
  <dl class="kv">
    <dt style="color:var(--c-asic)">Hashing</dt><dd>BM1370, 25 MHz clock, decoupling ladder</dd>
    <dt style="color:var(--c-power)">Power</dt><dd>TPS546D24A buck + L1; 3V3, 1V2 and 0V8 LDOs</dd>
    <dt style="color:var(--c-control)">Control</dt><dd>ESP32-S3, level shifter, I2C bus</dd>
    <dt style="color:var(--c-thermal)">Thermal</dt><dd>EMC2101, fan headers, heatsink</dd>
    <dt style="color:var(--c-io)">I/O</dt><dd>Barrel jack, USB-C, OLED, buttons, accessory port</dd>
  </dl>
  <h3>Start here</h3>
  <p><button class="btn primary" id="startTour">Start guided tour</button> <button class="btn" id="openAsic">Open the ASIC</button></p>
  <h3>PCB construction</h3>
  <dl class="kv"><dt>Size</dt><dd>${BW.toFixed(1)} × ${BH.toFixed(1)} mm</dd><dt>Layers</dt><dd>4 copper, 1.6 mm FR-4</dd><dt>Rules</dt><dd>6 mil trace/space, 0.3 mm holes</dd><dt>Copper</dt><dd>1 oz outer / 0.5 oz inner suggested</dd><dt>Assembly</dt><dd>Parts on both sides; reflow each side</dd></dl>
  <h3>Sources</h3>
  <div class="links"><a href="https://www.bitaxe.org/hardware" target="_blank" rel="noopener">bitaxe.org/hardware ↗</a><a href="${REPO}" target="_blank" rel="noopener">bitaxeGamma repo ↗</a><a href="${ESPM}" target="_blank" rel="noopener">ESP-Miner ↗</a><a href="https://osmu.wiki/" target="_blank" rel="noopener">OSMU wiki ↗</a></div>
  <p class="note">Positions, packages and connections come from the published KiCad files. Bodies are simplified, and the heatsink, fan and OLED are generic stand-ins.</p>
  </div>`;
}
function bindOverview(){
  const s = document.getElementById('startTour'); if(s) s.onclick = ()=>setMode('tour');
  const a = document.getElementById('openAsic'); if(a) a.onclick = ()=>select('U8',{fly:true});
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
function bindOptions(){
  const fo = document.getElementById('flowOpts');
  FLOWS.forEach(f=>{
    const l = document.createElement('label'); l.className='opt';
    l.innerHTML = `<input type="checkbox" id="f_${f.id}"><span class="sw" style="background:${f.color}"></span>${esc(f.name)}`;
    fo.appendChild(l);
    l.querySelector('input').addEventListener('change', e=>{ flowObjs[f.id].group.visible = e.target.checked; renderLegend(); });
  });
  document.getElementById('oCool').addEventListener('change',e=>{ coolGroup.visible = e.target.checked; });
  document.getElementById('oOled').addEventListener('change',e=>{ oledGroup.visible = e.target.checked; });
  document.getElementById('oExplode').addEventListener('change',e=>{ state.explodeTarget = e.target.checked?1:0; });
  document.getElementById('oXray').addEventListener('change',e=>{
    const on = e.target.checked;
    [boardMesh, ...boardGroup.userData.faces].forEach(m=>{ m.material.transparent = true; m.material.opacity = on? .18 : 1; m.material.depthWrite = !on; m.material.needsUpdate = true; });
  });
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
  document.getElementById('tNext').addEventListener('click',()=>{ if(state.tourIdx>=TOUR.length-1) setMode('free'); else goStep(state.tourIdx+1); });
  window.addEventListener('keydown',e=>{
    if(state.mode!=='tour' || e.target.tagName==='INPUT') return;
    if(e.key==='ArrowRight') document.getElementById('tNext').click();
    if(e.key==='ArrowLeft') goStep(state.tourIdx-1);
    if(e.key==='Escape') setMode('free');
  });
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
  if(cool) state.highlight = s.refs.concat(['HS1']);
  state.selected = s.refs[0] || null;
  applyFlows(s.flows);
  applyHighlight(); renderInspector();
  if(s.side==='iso' && !s.refs.length) setView('iso'); else if(cool) flyTo(new THREE.Vector3(-115,135,175), new THREE.Vector3(-4,20,14)); else frameRefs(s.refs, s.side);
}

/* block diagram */
function setPane(p){
  document.getElementById('vBoard').setAttribute('aria-pressed', p==='board');
  document.getElementById('vDiag').setAttribute('aria-pressed', p==='diag');
  const d = document.getElementById('diagram'); d.hidden = p!=='diag';
  if(p==='diag' && !d.dataset.built){ d.innerHTML = diagramSVG(); d.dataset.built='1';
    d.querySelectorAll('.blk').forEach(b=> b.addEventListener('click',()=>{ setPane('board'); select(b.dataset.ref,{fly:true}); })); }
}
function diagramSVG(){
  const B = (ref,x,y,w,h,title,sub,col)=>`<g class="blk" data-ref="${ref}" tabindex="0"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" style="stroke:${col}"/><text x="${x+12}" y="${y+22}" font-weight="600">${title}</text><text class="sub" x="${x+12}" y="${y+40}">${sub}</text></g>`;
  const W = (d,col,label,lx,ly,dash)=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="2" ${dash?'stroke-dasharray="5 4"':''} marker-end="url(#ar${col.slice(1)})"/>${label?`<text class="wl" x="${lx}" y="${ly}" fill="${col}">${label}</text>`:''}`;
  const P='#ff8a3d', Y='#ffc46b', C='#4cc9e0', I='#a98bff', T='#ff5d73', K='#e0e36a', G='#7ce0a0';
  return `<svg viewBox="0 0 1100 640" role="img" aria-label="Bitaxe Gamma block diagram">
  <defs>${[P,Y,C,I,T,K,G].map(c=>`<marker id="ar${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>
  <text class="cap" x="20" y="28">POWER</text><text class="cap" x="420" y="28">HASHING</text><text class="cap" x="780" y="28">CONTROL &amp; I/O</text>
  ${B('J1',20,50,170,56,'5 V DC input','J1 · barrel jack',P)}
  ${B('U2',20,150,170,62,'TPS546D24A','U2 · buck · PMBus 0x24',P)}
  ${B('L1',20,250,170,56,'L1 + output caps','300 nH · C14–C20',P)}
  ${B('U3',220,50,160,56,'3.3 V LDO','U3 · RT9080',Y)}
  ${B('U5',220,150,160,56,'1.2 V LDO','U5 · MCP1824',Y)}
  ${B('U6',220,250,160,56,'0.8 V LDO','U6 · MCP1824',Y)}
  ${B('U8',420,230,200,150,'BM1370 ASIC','U8 · 2040 small cores',css('--c-asic'))}
  ${B('U7',420,440,200,56,'25 MHz oscillator','U7 → CLKI',K)}
  ${B('U9',660,150,160,62,'Level shifter','U9 · 3.3 V ⇄ 1.2 V',C)}
  ${B('U4',860,150,200,110,'ESP32-S3','U4 · ESP-Miner / AxeOS',C)}
  ${B('U10',660,440,160,62,'EMC2101','U10 · I2C 0x4C',T)}
  ${B('J6',660,560,160,56,'40 mm 5 V fan','J6 / J7 · PWM + TACH',T)}
  ${B('J3',860,320,200,56,'OLED 128×32','J3 · I2C 0x3C',I)}
  ${B('J5',860,50,200,56,'USB-C (data only)','J5 · GPIO19/20',G)}
  ${B('J4',860,420,200,56,'Accessory port','J4 · GPIO39–42 · BAP',I)}
  ${B('SW2',860,520,200,56,'RESET / BOOT','SW1 → EN · SW2 → GPIO0',I)}
  ${W('M105,106 L105,148',P,'5 V',112,132)}
  ${W('M105,212 L105,248',P,'SW node',112,236)}
  ${W('M105,306 L105,350 L418,350',P,'VDD ≈1.15 V, up to ~20 A',200,343)}
  ${W('M190,78 L218,78',Y,'',0,0)}
  ${W('M190,78 L205,78 L205,178 L218,178',Y,'',0,0)}
  ${W('M205,178 L205,278 L218,278',Y,'',0,0)}
  ${W('M380,178 L400,178 L400,260 L418,260',Y,'1V2 → VDDIO_12',404,222)}
  ${W('M380,290 L418,290',Y,'0V8',386,284)}
  ${W('M380,90 L400,90 L400,130 L940,130 L940,148',Y,'3V3 → ESP32 · U9 · U10 · OLED',430,124)}
  ${W('M520,438 L520,382',K,'CLKI',528,418)}
  ${W('M858,185 L822,185',C,'TX/RST',823,176)}
  ${W('M660,185 L640,185 L640,280 L622,280',C,'CI · NRSTI',570,176)}
  ${W('M622,330 L652,330 L652,205 L660,205',C,'RO',630,346,true)}
  ${W('M822,205 L858,205',C,'RX',830,222,true)}
  ${W('M900,262 L900,318',I,'',0,0)}
  ${W('M880,262 L880,300 L640,300 L640,600 L10,600 L10,181 L18,181',I,'I2C / PMBus · SDA GPIO47 · SCL GPIO48',230,593)}
  ${W('M880,300 L740,300 L740,438',I,'',0,0)}
  ${W('M622,360 L700,360 L700,438',T,'TEMP_P/N',628,376)}
  ${W('M740,502 L740,558',T,'PWM / TACH',748,535)}
  ${W('M960,106 L960,148',G,'USB D+/D−',968,122)}
  ${W('M1060,448 L1080,448 L1080,205 L1062,205',I,'',0,0)}
  ${W('M1060,548 L1092,548 L1092,225 L1062,225',I,'',0,0)}
  <text class="wl" x="872" y="232" fill="${G}">Wi-Fi 2.4 GHz → Stratum pool</text>
  <text class="sub" x="20" y="620">Click any block to jump to that part on the 3D board.</text>
  </svg>`;
}

/* boot */
function boot(){
  if(!window.THREE || !THREE.OrbitControls){ document.getElementById('loading').textContent='Could not load the 3D engine. Check your connection and reload.'; return; }
  try{
    init(); buildLabels(); bindOptions(); renderList(); renderInspector();
  }catch(err){ console.error(err); const l=document.getElementById('loading'); if(l) l.textContent='Error: '+err.message; }
}
if(document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();

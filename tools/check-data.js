#!/usr/bin/env node
/* Consistency checks for js/data.js. Run: node tools/check-data.js (exits 1 on any problem). */
"use strict";
const fs = require('fs'), path = require('path'), vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
// data.js is a classic browser script; its top-level consts are not globals, so return them explicitly
const D = vm.runInNewContext(src + '\n;({EDGE,GROUPS,PARTS,PASSIVES,PKG,TPS,HOLES,PINS,FLOWS,TOUR,HS_CENTER})');

const errors = [];
const err = m => errors.push(m);
const onBoard = (x,y) => x >= D.EDGE.x0 && x <= D.EDGE.x1 && y >= D.EDGE.y0 && y <= D.EDGE.y1;
const MATS = ['esp','asic','inductor','jack','header','fanconn','button','pads','metal','ic'];
const FACES = ['+x','-x','+y','-y'];
const SIDES = ['top','bottom'];

// refs: unique across every table, plus the two objects app.js adds
const refs = [...D.PARTS.map(p=>p.ref), ...D.PASSIVES.map(p=>p[0]), ...D.TPS.map(t=>t[0]), ...D.HOLES.map(h=>h[0]), 'HS1', 'DSP1'];
const seen = new Set();
refs.forEach(r=>{ if(seen.has(r)) err(`duplicate ref ${r}`); seen.add(r); });

D.PARTS.forEach(p=>{
  const at = `part ${p.ref}`;
  ['name','group','side','what'].forEach(k=>{ if(!p[k]) err(`${at}: missing ${k}`); });
  if(!D.GROUPS[p.group]) err(`${at}: unknown group ${p.group}`);
  if(!SIDES.includes(p.side)) err(`${at}: side must be top or bottom`);
  if(!onBoard(p.x,p.y)) err(`${at}: (${p.x}, ${p.y}) is off the board`);
  if(!Array.isArray(p.dims) || p.dims.length!==3 || p.dims.some(v=>!(v>0))) err(`${at}: dims must be three positive numbers`);
  if(p.rot % 90 !== 0) err(`${at}: rot ${p.rot} is not a multiple of 90`);
  if(!MATS.includes(p.mat)) err(`${at}: unknown mat ${p.mat}`);
  if(p.face!==undefined && !FACES.includes(p.face)) err(`${at}: face must be one of ${FACES.join(' ')}`);
  if(['esp','jack'].includes(p.mat) && !p.face) err(`${at}: one-sided model needs a face`);
});

D.PASSIVES.forEach(([ref,val,size,x,y,rot,nets,group,role])=>{
  const at = `passive ${ref}`;
  if(!/^[RC]\d+$/.test(ref)) err(`${at}: ref must be R<n> or C<n>`);
  if(!D.PKG[size]) err(`${at}: no PKG entry for size ${size}`);
  if(!onBoard(x,y)) err(`${at}: (${x}, ${y}) is off the board`);
  if(rot % 90 !== 0) err(`${at}: rot ${rot} is not a multiple of 90`);
  if(!D.GROUPS[group] || group==='passive') err(`${at}: subgroup ${group} must be a real subsystem`);
  if(!nets || !role) err(`${at}: missing nets or role`);
});

D.TPS.forEach(([ref,x,y,net])=>{ if(!onBoard(x,y)) err(`test point ${ref}: off the board`); if(!net) err(`test point ${ref}: missing net`); });
D.HOLES.forEach(([ref,x,y,d,kind])=>{ if(!onBoard(x,y)) err(`hole ${ref}: off the board`); if(!['pad','hs'].includes(kind)) err(`hole ${ref}: kind must be pad or hs`); });

const pinNums = D.PINS.map(p=>p[0]);
for(let n=1;n<=30;n++) if(!pinNums.includes(n)) err(`PINS: pad ${n} missing`);

const flowIds = new Set();
D.FLOWS.forEach(f=>{
  if(flowIds.has(f.id)) err(`flow ${f.id}: duplicate id`); flowIds.add(f.id);
  if(!/^#[0-9a-f]{6}$/i.test(f.color)) err(`flow ${f.id}: colour must be #rrggbb`);
  (f.multi || [f.pts]).forEach((pts,i)=>{
    if(!pts || pts.length<2) err(`flow ${f.id}[${i}]: needs at least two points`);
    else pts.forEach(([x,y,s])=>{ if(!onBoard(x,y)) err(`flow ${f.id}[${i}]: point (${x}, ${y}) is off the board`); if(s!=='t'&&s!=='b') err(`flow ${f.id}[${i}]: side must be t or b`); });
  });
});

D.TOUR.forEach((s,i)=>{
  const at = `tour step ${i+1}`;
  if(!s.t || !s.p || !s.p.length) err(`${at}: missing title or text`);
  if(!['iso','top','bottom'].includes(s.side)) err(`${at}: side must be iso, top or bottom`);
  s.refs.forEach(r=>{ if(!seen.has(r)) err(`${at}: unknown ref ${r}`); });
  s.flows.forEach(f=>{ if(!flowIds.has(f)) err(`${at}: unknown flow ${f}`); });
});

if(errors.length){ console.error(errors.map(e=>'✗ '+e).join('\n')); console.error(`\n${errors.length} problem(s) in js/data.js`); process.exit(1); }
console.log(`✓ js/data.js OK: ${D.PARTS.length} parts, ${D.PASSIVES.length} passives, ${D.TPS.length} test points, ${D.HOLES.length} holes, ${D.FLOWS.length} flows, ${D.TOUR.length} tour steps`);

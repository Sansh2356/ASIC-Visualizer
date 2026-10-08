#!/usr/bin/env node
/* Consistency checks for src/data/index.js and every board in src/data/. Run: node tools/check-data.js (exits 1 on any problem). */
import fs from 'node:fs';
import '../src/data/boards.js';
import * as D from '../src/data/index.js';

// every board file on disk must be imported by boards.js, or it silently never registers
const dir = new URL('../src/data/', import.meta.url);
const loaded = fs.readFileSync(new URL('boards.js', dir), 'utf8');
const onDisk = fs.readdirSync(dir).filter(f=>f.endsWith('.js') && !['index.js','boards.js'].includes(f));

const errors = [];
const err = m => errors.push(m);
onDisk.filter(f=>!loaded.includes(`'./${f}'`)).forEach(f=>err(`src/data/${f} is not imported by boards.js`));

const MATS = ['esp','asic','inductor','jack','header','fanconn','button','pads','metal','ic','tdisplay'];
const FACES = ['+x','-x','+y','-y'];
const SIDES = ['top','bottom'];
const summary = [];

Object.values(D.BOARDS).forEach(B=>{
  const E = m => err(`[${B.id}] ${m}`);
  const onBoard = (x,y) => x >= B.EDGE.x0 && x <= B.EDGE.x1 && y >= B.EDGE.y0 && y <= B.EDGE.y1;
  ['id','tab','title','h1','sub','stats','topLayer','overview','diagram','asic','ART','HOLE_TEXT'].forEach(k=>{ if(!B[k]) E(`missing ${k}`); });
  if(!['F','B'].includes(B.topLayer)) E('topLayer must be F or B');
  if(!D.ASICS[B.asic.chip]) E(`unknown asic chip ${B.asic.chip}`);
  if(!B.asic.freqs.includes(B.asic.def)) E('asic.def must be one of asic.freqs');

  // refs: unique across every table, plus the objects app.js adds
  const refs = [...B.PARTS.map(p=>p.ref), ...B.PASSIVES.map(p=>p[0]), ...B.TPS.map(t=>t[0]), ...B.HOLES.map(h=>h[0]), ...B.COOLERS.map(c=>c.ref), ...(B.oled ? ['DSP1'] : [])];
  const seen = new Set();
  refs.forEach(r=>{ if(seen.has(r)) E(`duplicate ref ${r}`); seen.add(r); });

  B.PARTS.forEach(p=>{
    const at = `part ${p.ref}`;
    ['name','group','side','what'].forEach(k=>{ if(!p[k]) E(`${at}: missing ${k}`); });
    if(!D.GROUPS[p.group]) E(`${at}: unknown group ${p.group}`);
    if(!SIDES.includes(p.side)) E(`${at}: side must be top or bottom`);
    if(!onBoard(p.x,p.y)) E(`${at}: (${p.x}, ${p.y}) is off the board`);
    if(!Array.isArray(p.dims) || p.dims.length!==3 || p.dims.some(v=>!(v>0))) E(`${at}: dims must be three positive numbers`);
    if(p.rot % 90 !== 0) E(`${at}: rot ${p.rot} is not a multiple of 90`);
    if(!MATS.includes(p.mat)) E(`${at}: unknown mat ${p.mat}`);
    if(p.face!==undefined && !FACES.includes(p.face)) E(`${at}: face must be one of ${FACES.join(' ')}`);
    if(['esp','jack','tdisplay'].includes(p.mat) && !p.face) E(`${at}: one-sided model needs a face`);
    if(p.mat==='asic' && !p.mark) E(`${at}: asic needs a mark`);
    if(p.mat==='tdisplay' && !Array.isArray(p.screen)) E(`${at}: tdisplay needs screen lines`);
  });
  if(!B.PARTS.some(p=>p.mat==='asic')) E('no part with mat asic');

  B.PASSIVES.forEach(([ref,val,size,x,y,rot,nets,group,role,side])=>{
    const at = `passive ${ref}`;
    if(!/^[RC]\d+$/.test(ref)) E(`${at}: ref must be R<n> or C<n>`);
    if(!D.PKG[size]) E(`${at}: no PKG entry for size ${size}`);
    if(!onBoard(x,y)) E(`${at}: (${x}, ${y}) is off the board`);
    if(rot % 90 !== 0) E(`${at}: rot ${rot} is not a multiple of 90`);
    if(!D.GROUPS[group] || group==='passive') E(`${at}: subgroup ${group} must be a real subsystem`);
    if(!nets || !role) E(`${at}: missing nets or role`);
    else if(nets.split('/').some(n=>!n)) E(`${at}: nets "${nets}" has an empty name`);
    if(!SIDES.includes(side)) E(`${at}: side must be top or bottom`);
  });

  B.TPS.forEach(([ref,x,y,net,side])=>{ if(!onBoard(x,y)) E(`test point ${ref}: off the board`); if(!net) E(`test point ${ref}: missing net`); if(!SIDES.includes(side)) E(`test point ${ref}: bad side`); });
  B.HOLES.forEach(([ref,x,y,d,kind])=>{ if(!onBoard(x,y)) E(`hole ${ref}: off the board`); if(!B.HOLE_TEXT[kind]) E(`hole ${ref}: no HOLE_TEXT for kind ${kind}`); });
  B.COOLERS.forEach(c=>{ if(!onBoard(c.x,c.y)) E(`cooler ${c.ref}: off the board`); c.under.forEach(r=>{ if(!seen.has(r)) E(`cooler ${c.ref}: unknown ref ${r}`); }); });

  const flowIds = new Set();
  B.FLOWS.forEach(f=>{
    if(flowIds.has(f.id)) E(`flow ${f.id}: duplicate id`); flowIds.add(f.id);
    if(!/^#[0-9a-f]{6}$/i.test(f.color)) E(`flow ${f.id}: colour must be #rrggbb`);
    (f.multi || [f.pts]).forEach((pts,i)=>{
      if(!pts || pts.length<2) E(`flow ${f.id}[${i}]: needs at least two points`);
      else pts.forEach(([x,y,s])=>{ if(!onBoard(x,y)) E(`flow ${f.id}[${i}]: point (${x}, ${y}) is off the board`); if(s!=='t'&&s!=='b') E(`flow ${f.id}[${i}]: side must be t or b`); });
    });
  });

  B.TOUR.forEach((s,i)=>{
    const at = `tour step ${i+1}`;
    if(!s.t || !s.p || !s.p.length) E(`${at}: missing title or text`);
    if(!['iso','top','bottom'].includes(s.side)) E(`${at}: side must be iso, top or bottom`);
    s.refs.forEach(r=>{ if(!seen.has(r)) E(`${at}: unknown ref ${r}`); });
    s.flows.forEach(f=>{ if(!flowIds.has(f)) E(`${at}: unknown flow ${f}`); });
    if(s.cool && !B.COOLERS.length) E(`${at}: cool step but the board has no COOLERS`);
  });

  const colour = c => c==='asic' || flowIds.has(c);
  B.diagram.blocks.forEach(b=>{ if(!seen.has(b[0])) E(`diagram block ${b[0]}: unknown ref`); if(!colour(b[7])) E(`diagram block ${b[0]}: unknown colour ${b[7]}`); });
  B.diagram.wires.forEach(w=>{ if(!colour(w[1])) E(`diagram wire ${w[0]}: unknown colour ${w[1]}`); });
  (B.diagram.notes||[]).forEach(n=>{ if(!colour(n[3])) E(`diagram note "${n[0]}": unknown colour ${n[3]}`); });
  B.overview.subsystems.forEach(([g])=>{ if(!D.GROUPS[g]) E(`overview: unknown group ${g}`); });

  summary.push(`${B.id}: ${B.PARTS.length} parts, ${B.PASSIVES.length} passives, ${B.TPS.length} test points, ${B.HOLES.length} holes, ${B.FLOWS.length} flows, ${B.TOUR.length} tour steps`);
});

if(errors.length){ console.error(errors.map(e=>'✗ '+e).join('\n')); console.error(`\n${errors.length} problem(s) in board data`); process.exit(1); }
console.log('✓ board data OK\n  '+summary.join('\n  '));

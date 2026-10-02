#!/usr/bin/env node
/* Dumps footprints from a .kicad_pcb as JSON, to help write a board file in js/boards/.
   Run: node tools/kicad-extract.js board.kicad_pcb [--refs U,J,L] > footprints.json
   Each footprint: ref, value, lib footprint, KiCad x/y/rot, layer (F/B), dnp/bom flags, pad nets.
   Also prints the Edge.Cuts bounding box and mounting holes (footprints with no ref letter class). */
"use strict";
const fs = require('fs');

// minimal S-expression parser: lists become arrays, atoms stay strings (quoted strings unquoted)
function parse(src){
  let i = 0;
  const stack = [[]];
  while(i < src.length){
    const c = src[i];
    if(c === '('){ stack.push([]); i++; }
    else if(c === ')'){ const l = stack.pop(); stack[stack.length-1].push(l); i++; }
    else if(c === '"'){ let j = i+1, s = ''; while(src[j] !== '"'){ if(src[j] === '\\'){ s += src[j+1]; j += 2; } else s += src[j++]; } stack[stack.length-1].push(s); i = j+1; }
    else if(/\s/.test(c)) i++;
    else { let j = i; while(j < src.length && !/[\s()]/.test(src[j])) j++; stack[stack.length-1].push(src.slice(i,j)); i = j; }
  }
  return stack[0][0];
}
const kids = (node, name) => node.filter(n => Array.isArray(n) && n[0] === name);
const kid = (node, name) => kids(node, name)[0];
const prop = (fp, name) => { const p = kids(fp,'property').find(p => p[1] === name); return p ? p[2] : undefined; };

const [file, ...args] = process.argv.slice(2);
if(!file){ console.error('usage: node tools/kicad-extract.js board.kicad_pcb [--refs U,J,L]'); process.exit(2); }
const refsArg = args.indexOf('--refs');
const prefixes = refsArg >= 0 ? args[refsArg+1].split(',') : null;
const pcb = parse(fs.readFileSync(file, 'utf8'));

// board outline: bounding box of every Edge.Cuts primitive
const xs = [], ys = [], outline = [];
const walkEdge = n => {
  if(!Array.isArray(n)) return;
  const layer = kid(n,'layer');
  if(layer && layer[1] === 'Edge.Cuts'){
    const prim = [n[0]];
    ['start','end','mid','center','at'].forEach(k=>{ const p = kid(n,k); if(p){ xs.push(+p[1]); ys.push(+p[2]); prim.push(k+' '+p[1]+','+p[2]); } });
    const pts = kid(n,'pts'); if(pts) kids(pts,'xy').forEach(p=>{ xs.push(+p[1]); ys.push(+p[2]); prim.push(p[1]+','+p[2]); });
    outline.push(prim.join(' '));
  }
  if(n[0] !== 'footprint') n.forEach(walkEdge);
};
pcb.forEach(walkEdge);
// gr_circle/gr_arc extents are approximated by their points; good enough for rectangular boards

// courtyard size in footprint-local (unrotated) mm, i.e. the dims a board file wants before height
function courtyard(fp){
  const xs = [], ys = [];
  fp.filter(n => Array.isArray(n) && /^fp_/.test(n[0])).forEach(g => {
    const layer = kid(g,'layer'); if(!layer || !/CrtYd/.test(layer[1])) return;
    const pts = [...['start','end','mid','center'].map(k => kid(g,k)).filter(Boolean), ...(kid(g,'pts') ? kids(kid(g,'pts'),'xy') : [])];
    if(g[0] === 'fp_circle'){ const c = kid(g,'center'), e = kid(g,'end'), r = Math.hypot(e[1]-c[1], e[2]-c[2]); xs.push(+c[1]-r, +c[1]+r); ys.push(+c[2]-r, +c[2]+r); }
    else pts.forEach(p => { xs.push(+p[1]); ys.push(+p[2]); });
  });
  // custom footprints often have no courtyard: fall back to the extent of their pads
  if(!xs.length) kids(fp,'pad').forEach(p => { const a = kid(p,'at'), s = kid(p,'size'); if(!a || !s) return;
    xs.push(+a[1]-s[1]/2, +a[1]+s[1]/2); ys.push(+a[2]-s[2]/2, +a[2]+s[2]/2); });
  return xs.length ? [+(Math.max(...xs)-Math.min(...xs)).toFixed(2), +(Math.max(...ys)-Math.min(...ys)).toFixed(2)] : undefined;
}

const fps = kids(pcb,'footprint').map(fp => {
  const at = kid(fp,'at'), attr = kid(fp,'attr') || [];
  // net name is the last atom: KiCad ≤9 writes (net 12 "name"), KiCad 10 writes (net "name")
  const nets = [...new Set(kids(fp,'pad').map(p => { const n = kid(p,'net'); return n ? n[n.length-1] : null; }).filter(Boolean))];
  return {
    ref: prop(fp,'Reference'), value: prop(fp,'Value'), lib: fp[1],
    x: +at[1], y: +at[2], rot: +(at[3] || 0),
    side: kid(fp,'layer')[1] === 'F.Cu' ? 'F' : 'B',
    crtyd: courtyard(fp),
    dnp: attr.includes('dnp') || undefined, bom: attr.includes('exclude_from_bom') ? false : undefined,
    nets,
  };
}).filter(f => f.ref && (!prefixes || prefixes.some(p => new RegExp('^'+p+'\\d').test(f.ref))))
  .sort((a,b) => a.ref.localeCompare(b.ref, undefined, {numeric:true}));

console.log(JSON.stringify({
  edge: xs.length ? {x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys)} : null, outline,
  count: fps.length, footprints: fps,
}, null, 1));

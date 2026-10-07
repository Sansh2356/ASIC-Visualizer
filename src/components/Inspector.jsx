import { Fragment, useState, lazy, Suspense } from 'react';
import { useStore, BOARDS } from '../store/index.js';
import { GROUPS, ASICS, partCount } from '../data/index.js';

const HashEngine = lazy(() => import('../hash/HashEngine.jsx').then(m => ({ default: m.HashEngine })));

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const SUBSYS_LABEL = { asic: 'Hashing', power: 'Power', control: 'Control', thermal: 'Thermal', io: 'I/O' };

export function Inspector({ sceneRef }) {
  const boardId = useStore(s => s.boardId);
  const board = BOARDS[boardId];
  const selected = useStore(s => s.selected);
  const objs = useStore(s => s._objs);
  const { select, setMode } = useStore.getState();

  const handleSelect = (r, fly = false) => {
    select(r);
    sceneRef?.current?.select(r, { fly });
  };

  if (!selected || !objs[selected]) {
    return (
      <div className="insp">
        <Overview
          board={board}
          onStartTour={() => setMode('tour')}
          onOpenAsic={() => {
            const asic = board?.PARTS.find(p => p.mat === 'asic');
            if (asic) handleSelect(asic.ref, true);
          }}
        />
      </div>
    );
  }

  const d = objs[selected].data;
  const g = GROUPS[d.group] || GROUPS.mech;

  return (
    <div className="insp">
      <div className="kick">
        <span className="chip" style={{ color: `var(${g.color})` }}>
          {g.name}{d.subgroup ? ' · ' + GROUPS[d.subgroup].name : ''}
        </span>
        <span className="ref">{d.ref} · {d.side === 'top' ? 'top side' : 'bottom side'}</span>
      </div>
      <h2>{d.name}</h2>
      {d.part && <div className="pn">{d.part}{d.pkg ? ' · ' + d.pkg : ''}</div>}
      {d.dnp && <p className="note">Not populated in the BOM. The footprint is a design option.</p>}
      <h3>What it does</h3>
      <p>{d.what || ''}</p>
      {d.how && <><h3>How it works on the {board?.tab}</h3><p>{d.how}</p></>}
      {d.specs?.length > 0 && (
        <>
          <h3>Key facts</h3>
          <dl className="kv">
            {d.specs.map(([k, v]) => (
              <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>
            ))}
          </dl>
        </>
      )}
      {d.nets && (
        <><h3>Connected nets</h3><div className="nets">{d.nets.map(n => <span key={n}>{n}</span>)}</div></>
      )}
      {d.netsStr && !d.nets && (
        <><h3>Connected nets</h3><div className="nets">{d.netsStr.split('/').map(n => <span key={n}>{n}</span>)}</div></>
      )}
      {d.mat === 'asic' && board && (
        <>
          <AsicExtras board={board} />
          <Suspense fallback={<div style={{ padding: '10px', color: 'var(--c-fg2)', fontSize: 12 }}>Loading SHA-256 engine…</div>}>
            <HashEngine />
          </Suspense>
        </>
      )}
      {d.note && <p className="note">{d.note}</p>}
      {d.links && (
        <><h3>Source</h3><div className="links">{d.links.map(([t, u]) => <a key={u} href={u} target="_blank" rel="noopener">{t} ↗</a>)}</div></>
      )}
      <h3>Board position</h3>
      <dl className="kv">
        <dt>KiCad X, Y</dt><dd>{(+d.x).toFixed(2)}, {(+d.y).toFixed(2)} mm</dd>
        {d.rot !== undefined && <Fragment key="rot"><dt>Rotation</dt><dd>{d.rot}°</dd></Fragment>}
      </dl>
      <p style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => handleSelect(null)}>← Board overview</button>
      </p>
    </div>
  );
}

function Overview({ board, onStartTour, onOpenAsic }) {
  if (!board) return null;
  const O = board.overview;
  const pCount = partCount(board);
  return (
    <div className="overview">
      <div className="kick">
        <span className="chip" style={{ color: 'var(--gold)' }}>Overview</span>
        <span className="ref">{O.kick}</span>
      </div>
      <h2>{O.h2}</h2>
      <p>{O.intro}</p>
      <div className="ov-grid">
        {O.grid.map(([b, t], i) => <div key={i}><b dangerouslySetInnerHTML={{ __html: b }} /><span>{t}</span></div>)}
        <div><b>{pCount}</b><span>populated parts</span></div>
      </div>
      <h3>Subsystems</h3>
      <dl className="kv">
        {O.subsystems.map(([g, t]) => (
          <Fragment key={g}>
            <dt style={{ color: `var(${GROUPS[g].color})` }}>{SUBSYS_LABEL[g]}</dt>
            <dd>{t}</dd>
          </Fragment>
        ))}
      </dl>
      <h3>Start here</h3>
      <p>
        <button className="btn primary" onClick={onStartTour}>Start guided tour</button>{' '}
        <button className="btn" onClick={onOpenAsic}>Open the ASIC</button>
      </p>
      <h3>PCB construction</h3>
      <dl className="kv">
        <dt>Size</dt><dd>{board.BW.toFixed(1)} × {board.BH.toFixed(1)} mm</dd>
        {O.construction.map(([k, v]) => (
          <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>
        ))}
      </dl>
      <h3>Sources</h3>
      <div className="links">
        {O.links.map(([t, u]) => <a key={u} href={u} target="_blank" rel="noopener">{t} ↗</a>)}
      </div>
      <p className="note">{O.note}</p>
    </div>
  );
}

function AsicExtras({ board }) {
  const { freqs, def, count, chip } = board.asic;
  const A = ASICS[chip];
  const [fqIdx, setFqIdx] = useState(freqs.indexOf(def));
  const f = freqs[fqIdx];
  const hr = (f * A.smallCores * count / 1e6).toFixed(3);
  const pll = (f / A.clock).toFixed(1).replace(/\.0$/, '');

  return (
    <>
      <h3>Hashrate calculator</h3>
      <div className="calc">
        <label htmlFor="fq">
          <span>ASIC frequency</span><span>{f} MHz</span>
        </label>
        <input
          type="range" id="fq" min="0" max={freqs.length - 1} step="1" value={fqIdx}
          aria-label="Frequency" onChange={e => setFqIdx(+e.target.value)}
        />
        <div className="big">{hr} TH/s</div>
        <small>
          hashrate ≈ frequency × {A.smallCores} small cores{count > 1 ? ` × ${count} chips` : ''}.
          PLL ×{pll} from {A.clock} MHz clock. Presets: {freqs.join(', ')} MHz.
        </small>
      </div>
      <h3>Pinout (from the KiCad footprint)</h3>
      <div className="pinout" dangerouslySetInnerHTML={{ __html: pinoutSVG(board) }} />
    </>
  );
}

function flowColor(board, id) {
  if (id === 'asic') return getComputedStyle(document.documentElement).getPropertyValue('--c-asic').trim();
  return board.FLOWS.find(f => f.id === id)?.color || '#888';
}

function pinoutSVG(board) {
  const A = ASICS[board.asic.chip], N = A.pins.length, half = N / 2;
  const colors = {
    tap: 'var(--c-power)', gnd: 'var(--c-passive)', ctl: 'var(--c-control)',
    clk: flowColor(board, 'clk'), strap: 'var(--muted)', io: flowColor(board, 'rails'),
    temp: 'var(--c-thermal)', chain: 'var(--c-io)',
  };
  const W = 340, H = 330, bx = 120, bw = 100, by = 20, step = Math.min(18.6, 262 / (half - 1));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${board.asic.chip} pinout">`;
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="290" rx="6" fill="var(--panel-2)" stroke="var(--line)"/>`;
  const [[n1, name1, cap1, col1], [n2, name2, cap2, col2]] = A.exposed;
  s += `<rect x="${bx+14}" y="${by+20}" width="${bw-28}" height="60" rx="3" fill="none" stroke="var(${col1})" stroke-dasharray="3 3"/>`;
  s += `<text x="${bx+bw/2}" y="${by+46}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="var(${col1})">${n1} · ${name1}</text>`;
  s += `<text x="${bx+bw/2}" y="${by+62}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--muted)">${cap1}</text>`;
  s += `<rect x="${bx+14}" y="${by+92}" width="${bw-28}" height="170" rx="3" fill="none" stroke="var(${col2})" stroke-dasharray="3 3"/>`;
  s += `<text x="${bx+bw/2}" y="${by+176}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="var(${col2})">${n2} · ${name2}</text>`;
  s += `<text x="${bx+bw/2}" y="${by+192}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--muted)">${cap2}</text>`;
  A.pins.forEach(([n, name, k]) => {
    const left = n <= half, i = left ? n - 1 : N - n;
    const y = by + 14 + i * step, x0 = left ? bx - 10 : bx + bw, col = colors[k];
    s += `<rect x="${x0}" y="${y-3}" width="10" height="6" fill="${col}"/>`;
    s += `<text x="${left ? x0-4 : x0+14}" y="${y+3.5}" text-anchor="${left ? 'end' : 'start'}" font-family="IBM Plex Mono" font-size="10" fill="var(--fg)">${n} ${name}</text>`;
  });
  s += `</svg>`;
  s += `<p style="font-size:12px;color:var(--muted);margin-top:6px"><span style="color:var(--c-control)">■</span> control · <span style="color:${colors.clk}">■</span> clock · <span style="color:${colors.io}">■</span> I/O rails · <span style="color:var(--c-power)">■</span> domain taps · <span style="color:var(--c-thermal)">■</span> temp diode · <span style="color:var(--muted)">■</span> straps · <span style="color:var(--c-io)">■</span> chain outputs</p>`;
  return s;
}

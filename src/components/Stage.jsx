import { useRef, useEffect } from 'react';
import { useStore, BOARDS } from '../store/index.js';
import { useScene } from '../scene/useScene.js';
import { Tour } from './Tour.jsx';
import { CompareTable } from './CompareTable.jsx';

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

export function Stage({ sceneRefOut }) {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const tipRef = useRef(null);
  const legendRef = useRef(null);

  const pane = useStore(s => s.pane);
  const mode = useStore(s => s.mode);
  const boardId = useStore(s => s.boardId);
  const flowLegend = useStore(s => s._flowLegend || []);

  const sceneRef = useScene(canvasRef, labelsRef, tipRef);

  // Expose the scene ref upward for Sidebar and Inspector
  useEffect(() => {
    if (sceneRefOut) sceneRefOut.current = sceneRef.current;
  });

  // Block diagram rendering (not moved to React — use innerHTML like before)
  const diagramRef = useRef(null);
  useEffect(() => {
    if (pane !== 'diag' || !diagramRef.current) return;
    const d = diagramRef.current;
    if (d.dataset.built) return;
    const sc = sceneRef.current;
    if (!sc) return;
    const board = BOARDS[boardId];
    if (!board?.diagram) return;
    d.innerHTML = diagramSVG(board, sc);
    d.dataset.built = '1';
    d.querySelectorAll('.blk').forEach(b => {
      const open = () => { useStore.getState().setPane('board'); sc.select(b.dataset.ref, { fly: true }); useStore.getState().select(b.dataset.ref); };
      b.addEventListener('click', open);
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }, [pane, boardId]);

  // Clear diagram built flag when board changes
  useEffect(() => {
    if (diagramRef.current) delete diagramRef.current.dataset.built;
  }, [boardId]);

  return (
    <main className="stage" id="stage">
      <canvas id="cv" ref={canvasRef} />
      <div id="labels" ref={labelsRef} />
      <div id="tip" ref={tipRef} hidden />
      <div className="legend" id="legend" hidden={!flowLegend.length} ref={legendRef}>
        {flowLegend.map(f => (
          <div key={f.id}><i style={{ background: f.color }} />{f.name}</div>
        ))}
      </div>
      <div className="hint" id="hint" hidden={mode === 'tour'}>
        Drag to orbit · scroll to zoom · right-drag to pan · click a part
      </div>
      <div id="loading" hidden>BUILDING BOARD…</div>
      <Tour sceneRef={sceneRef} />
      <div id="diagram" ref={diagramRef} hidden={pane !== 'diag'} />
      <CompareTable />
    </main>
  );
}

function diagramSVG(board, sc) {
  const D = board.diagram;
  const flowColor = id => {
    const cssV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    if (id === 'asic') return cssV('--c-asic');
    return board.FLOWS.find(f => f.id === id)?.color || cssV('--c-mech');
  };
  const Bk = ([ref, x, y, w, h, title, sub, c]) =>
    `<g class="blk" data-ref="${ref}" tabindex="0" role="button" aria-label="${title}: ${sub}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" style="stroke:${flowColor(c)}"/><text x="${x + 12}" y="${y + 22}" font-weight="600">${title}</text><text class="sub" x="${x + 12}" y="${y + 40}">${sub}</text></g>`;
  const W = ([d, c, label, lx, ly, dash]) => {
    const col = flowColor(c);
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" ${dash ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#ar${col.slice(1)})"/>${label ? `<text class="wl" x="${lx}" y="${ly}" fill="${col}">${label}</text>` : ''}`;
  };
  const cols = [...new Set([...D.blocks.map(b => b[7]), ...D.wires.map(w => w[1])].map(flowColor))];
  return `<svg viewBox="0 0 1100 640" role="img" aria-label="${esc(board.title)} block diagram">
  <defs>${cols.map(c => `<marker id="ar${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>
  ${D.caps.map(([t, x]) => `<text class="cap" x="${x}" y="28">${t}</text>`).join('')}
  ${D.blocks.map(Bk).join('\n  ')}
  ${D.wires.map(W).join('\n  ')}
  ${(D.notes || []).map(([t, x, y, c]) => `<text class="wl" x="${x}" y="${y}" fill="${flowColor(c)}">${t}</text>`).join('')}
  <text class="sub" x="20" y="620">Click any block to jump to that part on the 3D board.</text>
  </svg>`;
}

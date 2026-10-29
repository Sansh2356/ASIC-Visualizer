import { useEffect, useState } from 'react';
import { useStore, BOARDS } from '../store/index.js';
import { stepsFor, placedBy, setDone, partQA } from '../data/assembly.js';
import { applyStep, resetStep } from './Tour.jsx';

const key = id => `asicv-asm-${id}`;
function loadProgress(id) {
  try { return { idx: 0, done: [], ...JSON.parse(localStorage.getItem(key(id))) }; }
  catch { return { idx: 0, done: [] }; }
}

export function Assembly({ sceneRef }) {
  const boardId = useStore(s => s.boardId);
  const board = BOARDS[boardId];
  const selected = useStore(s => s.selected);
  const objs = useStore(s => s._objs);
  const { setMode, select } = useStore.getState();
  const steps = stepsFor(boardId);

  const [prog, setProg] = useState(() => loadProgress(boardId));
  useEffect(() => { setProg(loadProgress(boardId)); }, [boardId]);
  useEffect(() => {
    try { localStorage.setItem(key(boardId), JSON.stringify(prog)); } catch {}
  }, [prog]);

  const idx = Math.min(prog.idx, (steps?.length || 1) - 1);
  const s = steps?.[idx];

  // The checkboxes alone decide which parts are on the board.
  useEffect(() => {
    if (steps) sceneRef?.current?.setTray(placedBy(steps, prog.done));
  }, [prog.done, boardId]);

  useEffect(() => {
    const sc = sceneRef?.current;
    if (!sc || !s) return;
    select(null);
    applyStep(sc, board, s);
    sc.setTray(placedBy(steps, prog.done));
    // Keep the parts being placed lit, e.g. the heatsink under a fan being mounted.
    if (s.place?.length) sc.applyHighlightForTour([...new Set([...s.refs, ...s.place.map(k => k.split(':')[0])])], s.refs[0] || null);
    if (s.place?.length || !s.refs.length) sc.frameTray(s.place, s.side);
  }, [idx, boardId, !!steps]);

  // Leaving assembly mode: put the scene back the way the free-mode toggles say.
  useEffect(() => () => {
    const sc = sceneRef?.current;
    if (!sc) return;
    sc.setTray(null);
    resetStep(sc);
  }, []);

  const goStep = i => setProg(p => ({ ...p, idx: Math.max(0, Math.min(steps.length - 1, i)) }));
  const markDone = (ks, on) => setProg(p => ({ ...p, done: ks.reduce((d, k) => setDone(steps, d, k, on), p.done) }));
  const toggleDone = k => markDone([k], !prog.done.includes(k));

  const header = (
    <div className="tour-panel-header">
      <span className="tour-panel-title">Assembly · {board?.tab}</span>
      <button className="tour-panel-close" onClick={() => setMode('free')} aria-label="Exit assembly">✕</button>
    </div>
  );

  if (!steps) {
    return (
      <div className="tour-panel">
        {header}
        <div className="tour-panel-body">
          <p className="note">No assembly guide for the {board?.title} yet. Guides exist for the Gamma, Gamma Hex and NerdQAxe++.</p>
        </div>
      </div>
    );
  }

  const part = selected && objs[selected]?.data;
  const partSteps = part ? partQA(boardId, selected) : [];

  return (
    <div className="tour-panel">
      {header}
      <div className="tour-panel-body">
        <div className="asm-progress">
          <span className="tour-step-label">Step {idx + 1}/{steps.length}</span>
          <span className="asm-count">{prog.done.length}/{steps.length} done</span>
        </div>
        <ol className="asm-list">
          {groupSteps(steps).map(([group, ks]) => {
            const row = k => (
              <li key={k} aria-current={k === idx} className={prog.done.includes(k) ? 'done' : ''}>
                <input type="checkbox" checked={prog.done.includes(k)} onChange={() => toggleDone(k)} aria-label={`Mark "${steps[k].t}" done`} />
                <button onClick={() => goStep(k)}>{steps[k].t}</button>
              </li>
            );
            if (!group) return row(ks[0]);
            const n = ks.filter(k => prog.done.includes(k)).length;
            return (
              <li key={group} className="asm-group">
                <details open={ks.includes(idx)}>
                  <summary className={n === ks.length ? 'done' : ''}>
                    <input
                      type="checkbox" checked={n === ks.length}
                      ref={el => { if (el) el.indeterminate = n > 0 && n < ks.length; }}
                      onClick={e => e.stopPropagation()}
                      onChange={() => markDone(ks, n < ks.length)}
                      aria-label={`Mark all of "${group}" done`}
                    />
                    {group} <span className="asm-count">{n}/{ks.length}</span>
                  </summary>
                  <ol className="asm-list">{ks.map(row)}</ol>
                </details>
              </li>
            );
          })}
        </ol>

        {part && (
          <div className="asm-part">
            <div className="asm-part-head">
              <b>{part.ref}</b> {part.name}
              <button className="tour-panel-close" onClick={() => select(null)} aria-label="Close part questions">✕</button>
            </div>
            {partSteps.length
              ? partSteps.map(st => <QA key={st.t} qa={st.qa} fix={st.fix} title={st.t} />)
              : <p>{part.what || 'No assembly questions for this part.'}</p>}
          </div>
        )}

        <h2 className="tour-step-title">{s.t}</h2>
        <ol className="asm-do">{s.do.map((t, i) => <li key={i}>{t}</li>)}</ol>
        <label className="asm-check">
          <input type="checkbox" checked={prog.done.includes(idx)} onChange={() => toggleDone(idx)} /> Done
        </label>
        <QA qa={s.qa} fix={s.fix} />
        <p className="asm-tip">Click any part on the board to see questions about it.</p>
      </div>
      <div className="tour-panel-nav">
        <button className="btn" disabled={idx === 0} onClick={() => goStep(idx - 1)}>← Back</button>
        <button className="btn primary" onClick={() => {
          markDone([idx], true);
          if (idx === steps.length - 1) setMode('free'); else goStep(idx + 1);
        }}>
          {idx === steps.length - 1 ? 'Finish' : 'Done, next →'}
        </button>
      </div>
    </div>
  );
}

function QA({ qa, fix, title }) {
  return (
    <>
      {title && <div className="asm-from">From “{title}”</div>}
      {qa.length > 0 && <h3>Common questions</h3>}
      {qa.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      {fix.length > 0 && <h3>Troubleshooting</h3>}
      {fix.map(([q, a]) => <details key={q} className="fix"><summary>{q}</summary><p>{a}</p></details>)}
    </>
  );
}

// Consecutive steps that share a `group` collapse into one list row: [group, [indices]].
function groupSteps(steps) {
  const out = [];
  steps.forEach((st, k) => {
    const last = out[out.length - 1];
    if (st.group && last?.[0] === st.group) last[1].push(k);
    else out.push([st.group || null, [k]]);
  });
  return out;
}

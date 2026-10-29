import { Fragment, useEffect, useState } from 'react';
import { useStore, BOARDS } from '../store/index.js';
import { stepsFor, placedBy, setActs, stepActs, stepState, blockedBy, actId, partQA } from '../data/assembly.js';
import { applyStep, resetStep } from './Tour.jsx';

const key = id => `asicv-asm-${id}`;
function loadProgress(id) {
  try {
    const p = { idx: 0, done: [], ...JSON.parse(localStorage.getItem(key(id))) };
    return { ...p, done: p.done.filter(d => typeof d === 'string') }; // drop pre-action progress
  } catch { return { idx: 0, done: [] }; }
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
  const tick = (ids, on) => setProg(p => ({ ...p, done: setActs(steps, p.done, ids, on) }));
  const state = k => stepState(steps, prog.done, k);
  const locked = k => blockedBy(steps, prog.done, k);
  const stepBox = (ks, label) => {
    const n = ks.filter(k => state(k) === 'all').length, some = ks.some(k => state(k) !== 'none');
    return (
      <input
        type="checkbox" checked={n === ks.length}
        ref={el => { if (el) el.indeterminate = some && n < ks.length; }}
        disabled={!some && ks.every(k => locked(k).length)}
        title={ks.length === 1 && locked(ks[0]).length ? 'Finish first: ' + locked(ks[0]).map(j => steps[j].t).join(', ') : undefined}
        onClick={e => e.stopPropagation()}
        onChange={() => tick(ks.flatMap(k => stepActs(steps, k)), n < ks.length)}
        aria-label={label}
      />
    );
  };

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
          <span className="asm-count">{steps.filter((_, k) => state(k) === 'all').length}/{steps.length} done</span>
        </div>
        <ol className="asm-list">
          {groupSteps(steps).map(([group, ks]) => {
            const row = k => (
              <li key={k} aria-current={k === idx} className={state(k) === 'all' ? 'done' : locked(k).length ? 'locked' : ''}>
                {stepBox([k], `Mark "${steps[k].t}" done`)}
                <button onClick={() => goStep(k)}>{steps[k].t}</button>
              </li>
            );
            if (!group) return row(ks[0]);
            const n = ks.filter(k => state(k) === 'all').length;
            return (
              <li key={group} className="asm-group">
                <details open={ks.includes(idx)}>
                  <summary className={n === ks.length ? 'done' : ''}>
                    {stepBox(ks, `Mark all of "${group}" done`)}
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
        {s.note && <p className="asm-note">{s.note}</p>}
        {locked(idx).length > 0 && (
          <p className="note">
            Finish first:{' '}
            {locked(idx).map((j, i) => <Fragment key={j}>{i > 0 && ', '}<button className="asm-link" onClick={() => goStep(j)}>{steps[j].t}</button></Fragment>)}
          </p>
        )}
        <ul className="asm-acts">
          {s.do.map((t, a) => {
            const id = actId(idx, a);
            return (
              <li key={id}>
                <label className={prog.done.includes(id) ? 'done' : ''}>
                  <input type="checkbox" checked={prog.done.includes(id)} disabled={!!locked(idx).length} onChange={e => tick([id], e.target.checked)} />
                  <span>{t}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <QA qa={s.qa} fix={s.fix} />
        <p className="asm-tip">Click any part on the board to see questions about it.</p>
      </div>
      <div className="tour-panel-nav">
        <button className="btn" disabled={idx === 0} onClick={() => goStep(idx - 1)}>← Back</button>
        {/* Moving on needs every action of this step ticked; the button never ticks anything itself. */}
        <button
          className="btn primary"
          disabled={state(idx) !== 'all'}
          title={state(idx) !== 'all' ? `Tick all ${s.do.length} actions of this step first` : undefined}
          onClick={() => { if (idx === steps.length - 1) setMode('free'); else goStep(idx + 1); }}
        >
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

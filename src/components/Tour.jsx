import { useEffect } from 'react';
import { useStore, BOARDS } from '../store/index.js';

// Highlight and frame a step's parts. Shared by the tour and assembly mode.
export function applyStep(sc, board, s) {
  sc.state.explodeTarget = s.explode ? 1 : 0;
  sc.setCoolVisible(!!s.cool);
  sc.applyFlows(s.flows);
  const refs = s.refs || [];
  const cool = !!s.cool;
  const highlight = refs.length ? refs.slice() : null;
  const highlighted = cool ? refs.concat(board.COOLERS.map(c => c.ref)) : highlight;
  sc.applyHighlightForTour(highlighted || [], refs[0] || null);

  if (refs.some(r => sc.getObjs()[r]?.isPassive)) sc.setPassivesVisible(true);
  if (cool) sc.frameCooler();
  else if (s.side === 'iso' && !refs.length) sc.setView('iso');
  else sc.frameRefs(refs, s.side);
}

export function Tour({ sceneRef }) {
  const boardId = useStore(s => s.boardId);
  const board = BOARDS[boardId];
  const mode = useStore(s => s.mode);
  const tourIdx = useStore(s => s.tourIdx);
  const { setMode, setTourIdx } = useStore.getState();

  useEffect(() => {
    if (mode !== 'tour' || !board || !sceneRef?.current) return;
    const s = board.TOUR[tourIdx];
    if (!s) return;

    applyStep(sceneRef.current, board, s);
  }, [mode, tourIdx, boardId]);

  useEffect(() => {
    const onKey = e => {
      if (mode !== 'tour' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') goStep(Math.max(0, tourIdx - 1));
      if (e.key === 'Escape') setMode('free');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, tourIdx]);

  if (!board || mode !== 'tour') return null;

  const TOUR = board.TOUR;
  const s = TOUR[tourIdx];
  if (!s) return null;

  const goStep = i => setTourIdx(Math.max(0, Math.min(TOUR.length - 1, i)));
  const next = () => { if (tourIdx >= TOUR.length - 1) setMode('free'); else goStep(tourIdx + 1); };

  return (
    <div className="tour-panel">
      <div className="tour-panel-header">
        <span className="tour-panel-title">Guided Tour</span>
        <button className="tour-panel-close" onClick={() => setMode('free')} aria-label="Exit tour">✕</button>
      </div>

      <div className="tour-panel-body">
        <div className="tour-step-label">Step {tourIdx + 1} of {TOUR.length}</div>
        <div className="dots">
          {TOUR.map((_, k) => (
            <button key={k} aria-label={`Go to step ${k + 1}`} aria-current={k === tourIdx} onClick={() => goStep(k)} />
          ))}
        </div>
        <h2 className="tour-step-title">{s.t}</h2>
        <div className="tour-step-body">
          {s.p.map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <div className="tour-panel-nav">
        <button className="btn" disabled={tourIdx === 0} onClick={() => goStep(tourIdx - 1)}>← Back</button>
        <button className="btn primary" onClick={next}>
          {tourIdx === TOUR.length - 1 ? 'Finish' : 'Next →'}
        </button>
      </div>
    </div>
  );
}

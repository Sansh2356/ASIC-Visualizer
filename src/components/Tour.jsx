import { useEffect } from 'react';
import { useStore, BOARDS } from '../store/index.js';

export function Tour({ sceneRef }) {
  const boardId = useStore(s => s.boardId);
  const board = BOARDS[boardId];
  const mode = useStore(s => s.mode);
  const tourIdx = useStore(s => s.tourIdx);
  const { setMode, setTourIdx } = useStore.getState();

  const hidden = mode !== 'tour';

  useEffect(() => {
    if (mode !== 'tour' || !board || !sceneRef?.current) return;
    const sc = sceneRef.current;
    const TOUR = board.TOUR;
    const s = TOUR[tourIdx];
    if (!s) return;

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

  if (!board || hidden) return null;

  const TOUR = board.TOUR;
  const s = TOUR[tourIdx];
  if (!s) return null;

  const goStep = i => setTourIdx(Math.max(0, Math.min(TOUR.length - 1, i)));
  const next = () => { if (tourIdx >= TOUR.length - 1) setMode('free'); else goStep(tourIdx + 1); };

  return (
    <div className="tour">
      <div className="step">STEP {tourIdx + 1} / {TOUR.length}</div>
      <h2>{s.t}</h2>
      <div>{s.p.map((t, i) => <p key={i}>{t}</p>)}</div>
      <div className="row">
        <div className="dots">
          {TOUR.map((_, k) => (
            <button key={k} aria-label={`Go to step ${k + 1}`} aria-current={k === tourIdx} onClick={() => goStep(k)} />
          ))}
        </div>
        <button className="btn" disabled={tourIdx === 0} onClick={() => goStep(tourIdx - 1)}>Back</button>
        <button className="btn primary" onClick={next}>{tourIdx === TOUR.length - 1 ? 'Finish' : 'Next'}</button>
      </div>
    </div>
  );
}

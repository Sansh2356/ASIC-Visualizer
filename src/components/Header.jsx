import { useStore, BOARDS } from '../store/index.js';

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

export function Header() {
  const board = useStore(s => BOARDS[s.boardId]);
  const boardId = useStore(s => s.boardId);
  const mode = useStore(s => s.mode);
  const pane = useStore(s => s.pane);
  const theme = useStore(s => s.theme);
  const { setBoard, setMode, setPane, toggleTheme } = useStore.getState();

  const allBoards = Object.values(BOARDS);
  const bitaxe = allBoards.filter(b => b.title.toLowerCase().includes('bitaxe'));
  const others  = allBoards.filter(b => !b.title.toLowerCase().includes('bitaxe'));

  return (
    <header className="top">
      <div className="header-row header-top">
        <div className="brand">
          <h1 dangerouslySetInnerHTML={{ __html: board?.h1 || 'ASIC Visualizer' }} />
          <span>{board?.sub || ''}</span>
        </div>
        <div className="spacer" />
        <div className="stats">
          {board?.stats.map(([k, v, t], i) => (
            <span key={i}>{k} <b>{v}</b>{t ? ' ' + t : ''}</span>
          ))}
        </div>
        <button
          className="theme-toggle"
          aria-label="Toggle light/dark mode"
          title="Toggle light/dark mode"
          onClick={toggleTheme}
        >
          <svg className="icon-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-7.5-1.4 1.4m-9.2 9.2-1.4 1.4m0-12.2 1.4 1.4m9.2 9.2 1.4 1.4"/>
          </svg>
          <svg className="icon-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </div>

      <div className="header-row header-bottom">
        <div className="seg" role="group" aria-label="Board">
          {bitaxe.map(b => (
            <button
              key={b.id}
              data-board={b.id}
              aria-pressed={b.id === boardId}
              title={b.title}
              onClick={() => setBoard(b.id)}
            >{b.tab}</button>
          ))}
          {others.length > 0 && (
            <>
              <span className="board-sep" aria-hidden="true" />
              {others.map(b => (
                <button
                  key={b.id}
                  data-board={b.id}
                  aria-pressed={b.id === boardId}
                  title={b.title}
                  onClick={() => setBoard(b.id)}
                >{b.tab}</button>
              ))}
            </>
          )}
        </div>
        <div className="spacer" />
        <div className="header-controls">
          <div className="seg" role="group" aria-label="Mode">
            <button id="mFree" aria-pressed={mode === 'free'} onClick={() => setMode('free')}>Free</button>
            <button id="mTour" aria-pressed={mode === 'tour'} onClick={() => setMode('tour')}>Guided</button>
          </div>
          <div className="seg" role="group" aria-label="View">
            <button id="vBoard" aria-pressed={pane === 'board'} onClick={() => setPane('board')}>3D board</button>
            <button id="vDiag" aria-pressed={pane === 'diag'} onClick={() => setPane('diag')}>Block diagram</button>
            <button id="vComp" aria-pressed={pane === 'comp'} onClick={() => setPane('comp')}>Compare</button>
          </div>
        </div>
      </div>
    </header>
  );
}

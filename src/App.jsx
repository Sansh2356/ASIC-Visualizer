import { useRef, useEffect } from 'react';
import { useStore, BOARDS } from './store/index.js';
import { Header } from './components/Header.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Stage } from './components/Stage.jsx';
import { Inspector } from './components/Inspector.jsx';

// Sidebar widths: [css var, default, min, max] in px. The drag handles clamp to these.
const PANES = { left: ['--left-w', 280, 200, 440], right: ['--right-w', 360, 300, 600] };
const savedW = side => { try { return +localStorage.getItem('asicv-w-' + side) || null; } catch { return null; } };

function Resizer({ side, appRef }) {
  const [v, def, min, max] = PANES[side];
  const set = w => {
    appRef.current.style.setProperty(v, w + 'px');
    try { localStorage.setItem('asicv-w-' + side, w); } catch {}
  };
  const onDown = e => {
    e.preventDefault();
    const app = appRef.current, handle = e.currentTarget, x0 = e.clientX;
    const w0 = app.querySelector('aside.' + side).getBoundingClientRect().width;
    app.classList.add('resizing'); handle.classList.add('active');
    const move = ev => {
      const dx = side === 'left' ? ev.clientX - x0 : x0 - ev.clientX;
      set(Math.round(Math.min(max, Math.max(min, w0 + dx))));
    };
    const up = () => { app.classList.remove('resizing'); handle.classList.remove('active'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };
  return (
    <div
      className={`resizer ${side}`} onPointerDown={onDown}
      onDoubleClick={() => { appRef.current.style.removeProperty(v); try { localStorage.removeItem('asicv-w-' + side); } catch {} }}
      role="separator" aria-orientation="vertical" aria-label={`Resize ${side} panel (${min}–${max} px, double-click to reset)`}
      title="Drag to resize · double-click to reset"
    />
  );
}

export function App() {
  const sceneRef = useRef(null);
  const appRef = useRef(null);

  // Restore saved sidebar widths
  useEffect(() => {
    Object.entries(PANES).forEach(([side, [v, , min, max]]) => {
      const w = savedW(side);
      if (w) appRef.current.style.setProperty(v, Math.min(max, Math.max(min, w)) + 'px');
    });
  }, []);

  // Resolve initial URL hash once on mount
  useEffect(() => {
    useStore.getState().initFromHash();

    // Listen for hash navigation
    const onHash = () => {
      const [boardId, ref] = location.hash.slice(1).split('/');
      if (BOARDS[boardId]) useStore.getState().setBoard(boardId);
      if (ref) {
        useStore.getState().select(ref);
        sceneRef.current?.select(ref, { fly: true });
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Apply theme attribute whenever store theme changes
  const theme = useStore(s => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const sidebarCollapsed = useStore(s => s.sidebarCollapsed);

  return (
    <div ref={appRef} className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <Header />
      <Sidebar sceneRef={sceneRef} />
      <Stage sceneRefOut={sceneRef}>
        {!sidebarCollapsed && <Resizer side="left" appRef={appRef} />}
        <Resizer side="right" appRef={appRef} />
      </Stage>
      <aside className="right" aria-label="Component inspector">
        <Inspector sceneRef={sceneRef} />
      </aside>
    </div>
  );
}

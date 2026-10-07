import { useRef, useEffect } from 'react';
import { useStore, BOARDS } from './store/index.js';
import { Header } from './components/Header.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Stage } from './components/Stage.jsx';
import { Inspector } from './components/Inspector.jsx';

export function App() {
  const sceneRef = useRef(null);

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

  // Sync OS theme preference changes when no preference is pinned
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = e => {
      if (!localStorage.getItem('asicv-theme')) {
        const dark = e.matches;
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        useStore.setState({ theme: dark ? 'dark' : 'light' });
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply theme attribute whenever store theme changes
  const theme = useStore(s => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="app">
      <Header />
      <Sidebar sceneRef={sceneRef} />
      <Stage sceneRefOut={sceneRef} />
      <aside className="right" aria-label="Component inspector">
        <Inspector sceneRef={sceneRef} />
      </aside>
    </div>
  );
}

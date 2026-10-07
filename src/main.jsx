import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import '../css/styles.css';

// Apply theme before React hydrates to prevent flash
(function () {
  const stored = localStorage.getItem('asicv-theme');
  const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();

createRoot(document.getElementById('root')).render(<App />);

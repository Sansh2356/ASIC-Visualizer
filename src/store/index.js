import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Boot the board registry by importing all boards
import '../data/boards.js';
import { BOARDS } from '../data/index.js';

export { BOARDS };

function storedTheme() { return localStorage.getItem('asicv-theme'); }
function systemDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }

const firstBoardId = () => Object.keys(BOARDS)[0];

const parseHash = (hash) => {
  const [boardId, ref] = hash.replace('#', '').split('/');
  return { boardId: BOARDS[boardId] ? boardId : null, ref: ref || null };
};

export const useStore = create(
  subscribeWithSelector((set, get) => ({
    // board
    boardId: firstBoardId(),

    // scene options
    showLabels: true,
    showPassives: true,
    showOled: true,
    showCool: false,
    explode: false,
    xray: false,
    showTP: false,
    colorBy: false,

    // active flows (array of flow ids)
    activeFlows: [],

    // flow legend entries (set by the scene after board loads)
    _flowLegend: [],

    // component registry — set by the scene after board loads; triggers sidebar re-render
    _objs: {},

    // interaction
    selected: null,
    hovered: null,
    highlight: null,

    // view mode: 'free' | 'tour'
    mode: 'free',
    tourIdx: 0,

    // pane: 'board' | 'diag' | 'comp'
    pane: 'board',

    // camera view preset
    cameraView: 'iso',

    // theme: 'light' | 'dark'
    theme: storedTheme() || (systemDark() ? 'dark' : 'light'),

    // actions
    setBoard(boardId) {
      if (!BOARDS[boardId]) return;
      const B = BOARDS[boardId];
      const pw = B.FLOWS.find(f => /power|core/i.test(f.name)) || B.FLOWS[0];
      set({
        boardId,
        selected: null,
        highlight: null,
        activeFlows: pw ? [pw.id] : [],
        pane: 'board',
        cameraView: 'iso',
        showCool: false,
        explode: false,
      });
      document.title = `ASIC Visualizer — ${B.title}`;
      const hash = boardId;
      if (location.hash.slice(1) !== hash) history.replaceState(null, '', '#' + hash);
    },

    setMode(mode) { set({ mode, tourIdx: 0 }); },
    setTourIdx(i) { set({ tourIdx: i }); },
    setPane(pane) { set({ pane }); },
    setCameraView(v) { set({ cameraView: v }); },

    select(ref) {
      const { boardId, mode } = get();
      set({ selected: ref, highlight: null });
      if (mode === 'free') {
        const newHash = ref ? `${boardId}/${ref}` : boardId;
        if (location.hash.slice(1) !== newHash) history.replaceState(null, '', '#' + newHash);
      }
    },

    setHovered(ref) { set({ hovered: ref }); },
    setHighlight(ref) { set({ highlight: ref }); },

    toggleFlow(id) {
      const { activeFlows } = get();
      set({
        activeFlows: activeFlows.includes(id)
          ? activeFlows.filter(f => f !== id)
          : [...activeFlows, id],
      });
    },

    setOption(key, val) { set({ [key]: val }); },

    toggleTheme() {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('asicv-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      set({ theme: next });
    },

    initFromHash() {
      const { boardId, ref } = parseHash(location.hash);
      if (boardId) get().setBoard(boardId);
      if (ref) set({ selected: ref });
    },
  }))
);

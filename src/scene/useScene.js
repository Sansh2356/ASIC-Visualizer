import { useEffect, useRef } from 'react';
import { Scene } from './scene.js';
import { useStore } from '../store/index.js';

export function useScene(canvasRef, labelsRef, tipRef) {
  const sceneRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelsEl = labelsRef.current;
    const tipEl = tipRef.current;
    if (!canvas || !labelsEl || !tipEl) return;

    const sc = new Scene(canvas, labelsEl, tipEl);
    sceneRef.current = sc;

    // Expose scene globally for debugging
    window.__scene = sc;

    sc.init();

    const { boardId, selected } = useStore.getState();
    sc.loadBoard(boardId);
    if (selected) sc.select(selected, { fly: false });

    // First-visit guided tour
    if (!localStorage.getItem('asicv-visited')) {
      localStorage.setItem('asicv-visited', '1');
      useStore.getState().setMode('tour');
    }

    return () => { sc.destroy(); sceneRef.current = null; };
  }, []); // eslint-disable-line

  return sceneRef;
}
